import json

from jsonschema import validate
from jsonschema.exceptions import ValidationError as SchemaValidationError
from kobo.apps.subsequences.models import SubmissionExtras
from kpi.models import Asset
from kpi.views.environment import _check_asr_mt_access_for_user
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as APIValidationError
from rest_framework.response import Response
from rest_framework.views import APIView


def _check_asr_mt_access_if_applicable(user, posted_data):
    # This is for proof-of-concept testing and will be replaced with proper
    # quotas and accounting
    MAGIC_STATUS_VALUE = 'requested'
    user_has_access = _check_asr_mt_access_for_user(user)
    if user_has_access:
        return True
    # Oops, no access. But did they request ASR/MT in the first place?
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
        for _, child_val in val.items():
            if not isinstance(child_val, dict):
                continue
            try:
                asr_mt_request = child_val['status'] == MAGIC_STATUS_VALUE
            except KeyError:
                continue
            else:
                if asr_mt_request:
                    # This is temporary code, and anyone here is trying to
                    # abuse the API, so don't bother translators with the
                    # message string
                    raise PermissionDenied('ASR/MT features are not available')


class AdvancedSubmissionView(APIView):
    queryset = Asset.objects.all()

    def get_object(self, uid):
        return self.queryset.get(uid=uid)

    def get(self, request, asset_uid, format=None):
        asset = self.get_object(asset_uid)
        if 'submission' in request.data:
            s_uuid = request.data.get('submission')
        else:
            s_uuid = request.query_params.get('submission')
        return get_submission_processing(asset, s_uuid)

    def post(self, request, asset_uid, format=None):
        asset = self.get_object(asset_uid)
        posted_data = request.data
        schema = asset.get_advanced_submission_schema()
        try:
            validate(posted_data, schema)
        except SchemaValidationError as err:
            raise APIValidationError({'error': err})

        _check_asr_mt_access_if_applicable(request.user, posted_data)

        submission = asset.update_submission_extra(posted_data)
        return Response(submission.content)


def get_submission_processing(asset, s_uuid):
    try:
        submission = asset.submission_extras.get(submission_uuid=s_uuid)
        return Response(submission.content)
    except SubmissionExtras.DoesNotExist:
        # submission might exist but no SubmissionExtras object has been created
        return Response({'info': f'nothing found for submission: {s_uuid}'})
