from copy import deepcopy

from django.conf import settings
from django.db.models import Q
from django.shortcuts import Http404
from jsonschema import validate
from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as APIValidationError
from rest_framework.response import Response

from kobo.apps.audit_log.base_views import AuditLoggedApiView
from kobo.apps.audit_log.models import AuditType
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.constants import GOOGLETS, GOOGLETX
from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils.deprecation import get_sanitized_dict_keys
from kpi.exceptions import UsageLimitExceededException
from kpi.models import Asset
from kpi.permissions import SubmissionPermission
from kpi.utils.usage_calculator import ServiceUsageCalculator
from kpi.views.environment import check_asr_mt_access_for_user


def _check_asr_mt_access_if_applicable(user, posted_data):
    # This is for proof-of-concept testing and will be replaced with proper
    # quotas and accounting
    MAGIC_STATUS_VALUE = 'requested'
    user_has_access = check_asr_mt_access_for_user(user)

    for _, val in posted_data.items():
        # e.g.
        # {
        #   "submission": "8b6c1fba-c9ef-477b-bfc0-873aa8bfd73f",
        #   "record_speech": {
        #     "googlets": {
        #       "status": "requested",
        #       "languageCode": "en"
        #     }
        #   }
        # }
        if not isinstance(val, dict):
            continue
        for child_key, child_val in val.items():
            if not isinstance(child_val, dict):
                continue
            try:
                asr_mt_request = child_val['status'] == MAGIC_STATUS_VALUE
            except KeyError:
                continue
            else:
                if asr_mt_request and not user_has_access:
                    # This is temporary code, and anyone here is trying to
                    # abuse the API, so don't bother translators with the
                    # message string
                    raise PermissionDenied('ASR/MT features are not available')

            if not settings.STRIPE_ENABLED:
                return True

            calculator = ServiceUsageCalculator(user)
            balances = calculator.get_usage_balances()
            if child_key == GOOGLETX:
                balance = balances[UsageType.MT_CHARACTERS]
                if balance and balance['exceeded']:
                    raise UsageLimitExceededException()
            if child_key == GOOGLETS:
                balance = balances[UsageType.ASR_SECONDS]
                if balance and balance['exceeded']:
                    raise UsageLimitExceededException()


class AdvancedSubmissionPermission(SubmissionPermission):
    """
    Regular `SubmissionPermission` maps POST to `add_submissions`, but
    `change_submissions` should be required here
    """
    perms_map = deepcopy(SubmissionPermission.perms_map)
    perms_map['POST'] = ['%(app_label)s.change_%(model_name)s']


class AdvancedSubmissionView(AuditLoggedApiView):
    permission_classes = [AdvancedSubmissionPermission]
    queryset = Asset.objects.all()
    asset = None
    log_type = AuditType.PROJECT_HISTORY

    def initial(self, request, asset_uid, *args, **kwargs):
        # This must be done first in order to work with SubmissionPermission
        # which typically expects to be a nested view under Asset
        self.asset = self.get_object(asset_uid)
        request._request.asset = self.asset
        return super().initial(request, asset_uid, *args, **kwargs)

    def get_object(self, uid):
        asset = self.queryset.get(uid=uid)
        self.check_object_permissions(self.request, asset)
        return asset

    def get(self, request, asset_uid, format=None):
        if 'submission' in request.data:
            s_uuid = request.data.get('submission')
        else:
            s_uuid = request.query_params.get('submission')

        self._validate_submission_or_404(s_uuid)
        return get_submission_processing(self.asset, s_uuid)

    def post(self, request, asset_uid, format=None):
        posted_data = request.data
        schema = self.asset.get_advanced_submission_schema()
        try:
            validate(posted_data, schema)
        except SchemaValidationError as err:
            raise APIValidationError({'error': err})

        # ensure the submission exists
        self._validate_submission_or_404(posted_data['submission'])

        _check_asr_mt_access_if_applicable(request.user, posted_data)

        submission = self.asset.update_submission_extra(posted_data)
        return Response(submission.content)

    @staticmethod
    def _validate_submission_or_404(s_uuid: str):
        # TODO: Remove fallback check for `root_uuid=None` once
        #  0005 long-running migration is complete
        if not Instance.objects.filter(
            Q(root_uuid=s_uuid) | Q(uuid=s_uuid, root_uuid__isnull=True)
        ).exists():
            raise Http404


def get_submission_processing(asset, s_uuid):
    try:
        submission_extra = asset.submission_extras.get(submission_uuid=s_uuid)

        # TODO delete "if" statement below when every asset is repopulated with
        #  `xpath` instead of `qpath`.
        if content := get_sanitized_dict_keys(submission_extra.content, asset):
            submission_extra.content = content

        return Response(submission_extra.content)
    except SubmissionExtras.DoesNotExist:
        # submission might exist but no SubmissionExtras object has been created
        return Response({'info': f'nothing found for submission: {s_uuid}'})
