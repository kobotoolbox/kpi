import copy
import json
import re

import requests
from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.utils.translation import gettext_lazy as t
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from pymongo.errors import OperationFailure
from rest_framework import renderers, serializers, status
from rest_framework.decorators import action
from rest_framework.pagination import _positive_int as positive_int
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.audit_log.utils import SubmissionUpdate
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kobo.apps.openrosa.libs.utils.logger_tools import http_open_rosa_error_handler
from kpi.authentication import EnketoSessionAuthentication
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
)
from kpi.exceptions import (
    InvalidXFormException,
    MissingXFormException,
    ObjectDeploymentDoesNotExist,
)
from kpi.models import Asset
from kpi.paginators import DataPagination
from kpi.permissions import (
    DuplicateSubmissionPermission,
    EditLinkSubmissionPermission,
    SubmissionPermission,
    SubmissionValidationStatusPermission,
    ViewSubmissionPermission,
)
from kpi.renderers import (
    BasicHTMLRenderer,
    SubmissionGeoJsonRenderer,
    SubmissionXMLRenderer,
)
from kpi.schema_extensions.v2.data.serializers import (
    DataBulkDelete,
    DataBulkUpdate,
    DataBulkUpdateResponse,
    DataResponse,
    DataStatusesUpdate,
    DataValidationStatusesUpdatePayload,
    DataValidationStatusUpdatePayload,
    DataValidationStatusUpdateResponse,
    EnketoEditResponse,
    EnketoViewResponse,
)
from kpi.serializers.v2.data import DataBulkActionsValidator
from kpi.utils.log import logging
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_204_empty_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.xml import (
    fromstring_preserve_root_xmlns,
    get_or_create_element,
    xml_tostring,
)


@extend_schema(
    tags=['Survey data'],
    parameters=[
        OpenApiParameter(
            name='uid_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
    ],
)
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('kpi', 'data/delete.md'),
        request=None,
        responses=open_api_204_empty_response(
            validate_payload=False, require_auth=False, raise_access_forbidden=False
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    ),
    duplicate=extend_schema(
        description=read_md('kpi', 'data/duplicate.md'),
        request={'application/json': DataBulkDelete},
        responses=open_api_200_ok_response(
            DataResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    ),
    list=extend_schema(
        description=read_md('kpi', 'data/list.md'),
        request=None,
        responses=open_api_200_ok_response(
            DataResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'data/retrieve.md'),
        request=None,
        responses=open_api_200_ok_response(
            DataResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    ),
)
class DataViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedViewSet
):
    """
    Viewset for managing the current user's data

    Available actions:
    - bulk                  → DELETE /api/v2/assets/
    - bulk                  → PATCH /api/v2/asset_usage/
    - delete                → DELETE /api/v2/asset_usage/{uid_asset}/data/{id}
    - duplicate             → POST /api/v2/asset_usage/{uid_asset}/data/duplicate  # noqa
    - list                  → GET /api/v2/asset_usage/{uid_asset}/data
    - retrieve              → GET /api/v2/asset_usage/{uid_asset}/data/{id}
    - validation_status     → GET /api/v2/asset_usage/{uid_asset}/data/{id}/validation_status  # noqa
    - validation_status     → DELETE /api/v2/asset_usage/{uid_asset}/data/{id}/validation_status  # noqa
    - validation_status     → PATCH /api/v2/asset_usage/{uid_asset}/data/{id}/validation_status  # noqa
    - validation_statuses   → DELETE /api/v2/asset_usage/{uid_asset}/data/{id}/validation_statuses  # noqa
    - validation_statuses   → PATCH /api/v2/asset_usage/{uid_asset}/data/{id}/validation_statuses  # noqa
    - enketo_edit           → GET /api/v2/assets/{uid_asset}/data/{id}/edit/
    - enketo_edit           → GET /api/v2/assets/{uid_asset}/data/{id}/enketo/edit/
    - enketo_edit           → GET /api/v2/assets/{uid_asset}/data/{id}/enketo/redirect/edit/
    - enketo_view           → GET /api/v2/assets/{uid_asset}/data/{id}/enketo/view/
    - enketo_view           → GET /api/v2/assets/{uid_asset}/data/{id}/enketo/redirect/view/

    Documentation:
    - docs/api/v2/data/bulk_delete.md
    - docs/api/v2/data/bulk_update.md
    - docs/api/v2/data/delete.md
    - docs/api/v2/data/duplicate.md
    - docs/api/v2/data/list.md
    - docs/api/v2/data/retrieve.md
    - docs/api/v2/data/validation_status_delete.md
    - docs/api/v2/data/validation_status_retrieve.md
    - docs/api/v2/data/validation_status_update.md
    - docs/api/v2/data/validation_statuses_delete.md
    - docs/api/v2/data/validation_statuses_update.md
    - docs/api/v2/data/enketo_view.md
    - docs/api/v2/data/enketo_edit.md
    """

    parent_model = Asset
    renderer_classes = (
        renderers.JSONRenderer,
        BasicHTMLRenderer,
        SubmissionGeoJsonRenderer,
        SubmissionXMLRenderer,
    )
    permission_classes = (SubmissionPermission,)
    pagination_class = DataPagination
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = []

    @extend_schema(
        methods=['PATCH'],
        description=read_md('kpi', 'data/bulk_update.md'),
        request={'application/json': DataBulkUpdate},
        responses=open_api_200_ok_response(
            DataBulkUpdateResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    )
    @extend_schema(
        methods=['DELETE'],
        description=read_md('kpi', 'data/bulk_delete.md'),
        request={'application/json': DataBulkDelete},
        responses=open_api_200_ok_response(
            validate_payload=False, require_auth=False, raise_access_forbidden=False
        ),
    )
    @action(
        detail=False,
        methods=['PATCH', 'DELETE'],
        renderer_classes=[renderers.JSONRenderer],
    )
    def bulk(self, request, *args, **kwargs):
        if request.method == 'DELETE':
            response = self._bulk_delete(request)
        elif request.method == 'PATCH':
            response = self._bulk_update(request)

        return Response(**response)

    def destroy(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        # Coerce to int because back end only finds matches with same type
        submission_id = positive_int(pk)

        if deployment.delete_submission(submission_id, user=request.user):
            response = {
                'content_type': 'application/json',
                'status': status.HTTP_204_NO_CONTENT,
            }
        else:
            response = {
                'data': {'detail': 'Submission not found'},
                'content_type': 'application/json',
                'status': status.HTTP_404_NOT_FOUND,
            }
        return Response(**response)

    @action(
        detail=True,
        methods=['POST'],
        permission_classes=[DuplicateSubmissionPermission],
        renderer_classes=[renderers.JSONRenderer],
    )
    def duplicate(self, request, pk, *args, **kwargs):
        """
        Creates a duplicate of the submission with a given `pk`
        """
        deployment = self._get_deployment()
        # Coerce to int because the back end only finds matches with the same type
        submission_id = positive_int(pk)
        original_submission = deployment.get_submission(
            submission_id=submission_id, user=request.user, fields=['_id', '_uuid']
        )

        with http_open_rosa_error_handler(
            lambda: deployment.duplicate_submission(
                submission_id=submission_id, request=request
            ),
            request,
        ) as handler:
            if handler.http_error_response:
                response = {
                    'data': handler.error,
                    'content_type': 'application/json',
                    'status': handler.status_code,
                }
            else:
                duplicate_submission = handler.func_return
                deployment.copy_submission_extras(
                    original_submission['_uuid'], duplicate_submission['_uuid']
                )
                response = {
                    'data': duplicate_submission,
                    'content_type': 'application/json',
                    'status': status.HTTP_201_CREATED,
                }
            return Response(**response)

    @extend_schema(
        description=read_md('kpi', 'data/enketo_edit.md'),
        responses=open_api_200_ok_response(
            EnketoEditResponse,
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    )
    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[EditLinkSubmissionPermission],
        url_path='enketo/edit',
        renderer_classes=[renderers.JSONRenderer],
    )
    def enketo_edit(self, request, pk, *args, **kwargs):
        submission_id = positive_int(pk)
        enketo_response = self._get_enketo_link(request, submission_id, 'edit')
        if enketo_response.status_code in (
            status.HTTP_201_CREATED, status.HTTP_200_OK
        ):
            # See https://github.com/enketo/enketo-express/issues/187
            EnketoSessionAuthentication.prepare_response_with_csrf_cookie(
                request, enketo_response
            )
        return self._handle_enketo_redirect(request, enketo_response, *args, **kwargs)

    @extend_schema(
        description=read_md('kpi', 'data/enketo_view.md'),
        responses=open_api_200_ok_response(
            EnketoViewResponse,
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    )
    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[ViewSubmissionPermission],
        url_path='enketo/view',
        renderer_classes=[renderers.JSONRenderer],
    )
    def enketo_view(self, request, pk, *args, **kwargs):
        submission_id = positive_int(pk)
        enketo_response = self._get_enketo_link(request, submission_id, 'view')
        return self._handle_enketo_redirect(request, enketo_response, *args, **kwargs)

    def get_queryset(self):
        # This method is required by Django REST Framework's internal routing
        # and pagination logic, even when not using a standard Django database.
        # Because data comes from Mongo, `list()` and `retrieve()` don't need
        # Django Queryset, we only need return `None`.
        return None

    def get_renderers(self):
        if self.action == 'destroy':
            return [
                renderers.JSONRenderer(),
            ]
        return super().get_renderers()

    def list(self, request, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = self._filter_mongo_query(request)

        if format_type == 'geojson':
            # For GeoJSON, get the submissions as JSON and let
            # `SubmissionGeoJsonRenderer` handle the rest
            return Response(
                deployment.get_submissions(
                    user=request.user,
                    format_type=SUBMISSION_FORMAT_TYPE_JSON,
                    request=request,
                    **filters
                )
            )

        try:
            submissions = deployment.get_submissions(
                request.user, format_type=format_type, request=request, **filters
            )
        except OperationFailure as err:
            message = str(err)
            # Don't show just any raw exception message out of fear of data leaking
            if message == '$all needs an array':
                raise serializers.ValidationError(message)
            logging.warning(message, exc_info=True)
            raise serializers.ValidationError('Unsupported query')
        # Create a dummy list to let the Paginator do all the calculation
        # for pagination because it does not need the list of real objects.
        # It avoids retrieving all the objects from MongoDB
        dummy_submissions_list = [None] * deployment.current_submission_count
        page = self.paginate_queryset(dummy_submissions_list)
        if page is not None:
            return self.get_paginated_response(submissions)

        return Response(list(submissions))

    def retrieve(self, request, pk, *args, **kwargs):
        """
        Retrieve a submission by its primary key or its UUID.

        Warning when using the UUID. Submissions can have the same uuid because
        there is no unique constraint on this field. The first occurrence
        will be returned.
        """
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        params = {
            'user': request.user,
            'format_type': format_type,
            'request': request,
        }
        filters = self._filter_mongo_query(request)

        # Unfortunately, Django expects that the URL parameter is `pk`,
        # its name cannot be changed (easily).
        submission_id_or_uuid = pk
        try:
            submission_id_or_uuid = positive_int(submission_id_or_uuid)
        except ValueError:
            if not re.match(
                r'[a-z\d]{8}-([a-z\d]{4}-){3}[a-z\d]{12}', submission_id_or_uuid
            ):
                raise Http404

            try:
                query = json.loads(filters.pop('query', '{}'))
            except json.JSONDecodeError:
                raise serializers.ValidationError(
                    {'query': t('Value must be valid JSON.')}
                )
            query['_uuid'] = submission_id_or_uuid
            filters['query'] = query
        else:
            params['submission_ids'] = [submission_id_or_uuid]

        # Join all parameters to be passed to `deployment.get_submissions()`
        params.update(filters)

        submissions = deployment.get_submissions(**params)
        if not submissions:
            raise Http404

        submission = list(submissions)[0]
        return Response(submission)

    @extend_schema(
        methods=['PATCH'],
        description=read_md('kpi', 'data/validation_status_update.md'),
        request={'application/json': DataValidationStatusUpdatePayload},
        responses=open_api_200_ok_response(
            DataValidationStatusUpdateResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    )
    @extend_schema(
        methods=['DELETE'],
        description=read_md('kpi', 'data/validation_status_delete.md'),
        request=None,
        responses=open_api_204_empty_response(
            validate_payload=False, require_auth=False, raise_access_forbidden=False
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    )
    @extend_schema(
        methods=['GET'],
        description=read_md('kpi', 'data/validation_status_retrieve.md'),
        request=None,
        responses=open_api_200_ok_response(
            DataValidationStatusUpdateResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='id',
                type=int,
                location=OpenApiParameter.PATH,
                required=True,
                description='ID of the data',
            ),
        ],
    )
    @action(
        detail=True,
        methods=['GET', 'PATCH', 'DELETE'],
        permission_classes=[SubmissionValidationStatusPermission],
        renderer_classes=[renderers.JSONRenderer],
    )
    def validation_status(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        # Coerce to int because back end only finds matches with same type
        submission_id = positive_int(pk)
        if request.method == 'GET':
            json_response = deployment.get_validation_status(
                submission_id=submission_id,
                user=request.user,
            )
        else:
            json_response = deployment.set_validation_status(
                submission_id=submission_id,
                user=request.user,
                data=request.data,
                method=request.method,
            )

        return Response(**json_response)

    @extend_schema(
        methods=['DELETE'],
        description=read_md('kpi', 'data/validation_statuses_delete.md'),
        request=None,
        responses=open_api_204_empty_response(
            validate_payload=False, require_auth=False, raise_access_forbidden=False
        ),
    )
    @extend_schema(
        methods=['PATCH'],
        description=read_md('kpi', 'data/validation_statuses_update.md'),
        request={'application/json': DataValidationStatusesUpdatePayload},
        responses=open_api_200_ok_response(
            DataStatusesUpdate,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    )
    @action(
        detail=False,
        methods=['PATCH', 'DELETE'],
        permission_classes=[SubmissionValidationStatusPermission],
        renderer_classes=[renderers.JSONRenderer],
    )
    def validation_statuses(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        bulk_actions_validator = DataBulkActionsValidator(
            data=request.data,
            context=self.get_serializer_context(),
            perm=PERM_VALIDATE_SUBMISSIONS
        )
        bulk_actions_validator.is_valid(raise_exception=True)
        json_response = deployment.set_validation_statuses(
            request.user, bulk_actions_validator.data)

        return Response(**json_response)

    def _bulk_delete(self, request: Request) -> dict:
        deployment = self._get_deployment()
        serializer_params = {
            'data': request.data,
            'context': self.get_serializer_context(),
            'perm': PERM_DELETE_SUBMISSIONS,
        }
        bulk_actions_validator = DataBulkActionsValidator(**serializer_params)
        bulk_actions_validator.is_valid(raise_exception=True)

        # Prepare audit logs
        data = copy.deepcopy(bulk_actions_validator.data)
        # Retrieve all submissions matching `submission_ids` or `query`.

        submissions = deployment.get_submissions(
            user=request.user,
            submission_ids=data['submission_ids'],
            query=data['query'],
            fields=['_id', '_uuid', '_submitted_by', 'meta/rootUuid'],
        )

        # Prepare logs before deleting all submissions.
        request._request.instances = {
            sub['_id']: SubmissionUpdate(
                id=sub['_id'],
                username=sub['_submitted_by'],
                action='delete',
                root_uuid=remove_uuid_prefix(sub['meta/rootUuid']),
            )
            for sub in submissions
        }
        request._request.asset = self.asset

        try:
            deleted = deployment.delete_submissions(
                bulk_actions_validator.data, request.user
            )
        except (MissingXFormException, InvalidXFormException):
            return {
                'data': {'detail': 'Could not delete submissions'},
                'content_type': 'application/json',
                'status': status.HTTP_400_BAD_REQUEST,
            }

        return {
            'data': {'detail': f'{deleted} submissions have been deleted'},
            'content_type': 'application/json',
            'status': status.HTTP_200_OK,
        }

    def _bulk_update(self, request: Request) -> dict:
        deployment = self._get_deployment()
        serializer_params = {
            'data': request.data,
            'context': self.get_serializer_context(),
            'perm': PERM_CHANGE_SUBMISSIONS,
        }
        bulk_actions_validator = DataBulkActionsValidator(**serializer_params)
        bulk_actions_validator.is_valid(raise_exception=True)

        try:
            return deployment.bulk_update_submissions(
                bulk_actions_validator.data, request.user, request=request
            )
        except (MissingXFormException, InvalidXFormException):
            return {
                'data': {'detail': 'Could not updated submissions'},
                'content_type': 'application/json',
                'status': status.HTTP_400_BAD_REQUEST,
            }

    def _filter_mongo_query(self, request):
        """
        Build filters to pass to Mongo query.
        Acts like Django `filter_backends`

        :param request:
        :return: dict
        """
        filters = {}

        if request.method == 'GET':
            filters = request.GET.dict()

        # Remove `format` from filters. No need to use it
        filters.pop('format', None)
        # Do not allow requests to retrieve more than `max_limit`
        # submissions at one time only if a limit is explicitly defined.
        if 'limit' in filters:
            try:
                filters['limit'] = positive_int(
                    filters['limit'],
                    strict=True,
                    cutoff=self.pagination_class.max_limit,
                )
            except ValueError:
                raise serializers.ValidationError(
                    {'limit': t('A positive integer is required')}
                )
        else:
            # If no limit is specified, use the default limit (100)
            filters['limit'] = self.pagination_class.default_limit

        return filters

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        if not self.asset.has_deployment:
            raise ObjectDeploymentDoesNotExist(
                t('The specified asset has not been deployed')
            )

        return self.asset.deployment

    def _get_enketo_link(
        self, request: Request, submission_id: int, action_: str
    ) -> Response:

        deployment = self._get_deployment()
        user = request.user

        if action_ == 'edit':
            enketo_endpoint = settings.ENKETO_EDIT_INSTANCE_ENDPOINT
            partial_perm = PERM_CHANGE_SUBMISSIONS
        elif action_ == 'view':
            enketo_endpoint = settings.ENKETO_VIEW_INSTANCE_ENDPOINT
            partial_perm = PERM_VIEW_SUBMISSIONS

        # User's permissions are validated by the permission class. This extra step
        # is needed to validate at a row level for users with partial permissions.
        # A `PermissionDenied` error will be raised if it is not the case.
        # `validate_access_with_partial_perms()` is called no matter what are the
        # user's permissions. The first check inside the method is the user's
        # permissions. `submission_ids` should be equal to `None` if user has
        # regular permissions.
        deployment.validate_access_with_partial_perms(
            user=user,
            perm=partial_perm,
            submission_ids=[submission_id],
        )

        # The XML version is needed for Enketo
        submission_xml = deployment.get_submission(
            submission_id, user, SUBMISSION_FORMAT_TYPE_XML
        )
        if isinstance(submission_xml, str):
            # Workaround for "Unicode strings with encoding declaration are not
            # supported. Please use bytes input or XML fragments without
            # declaration."
            # TODO: handle this in a unified way instead of haphazardly. See,
            # e.g., `kpi.utils.xml.strip_nodes()`
            submission_xml = submission_xml.encode()
        submission_xml_root = fromstring_preserve_root_xmlns(submission_xml)
        # The JSON version is needed to detect its version
        submission_json = deployment.get_submission(
            submission_id, user, request=request
        )

        # Block edit if the submission has duplicates.
        if (
            Instance.objects.filter(
                uuid=remove_uuid_prefix(
                    submission_json[deployment.SUBMISSION_CURRENT_UUID_XPATH]
                ),
                xform_id=deployment.xform_id,
            )
            .exclude(pk=submission_id)
            .exists()
        ):
            # Return an error immediately to prevent the user from receiving an error
            # when submitting their edit in Enketo
            return Response(
                {
                    'detail': (
                        'A duplicate submission has been detected. '
                        'This submission cannot be edited at the moment.'
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Add mandatory XML elements if they are missing from the original
        # submission. They could be overwritten unconditionally, but be
        # conservative for now and don't modify anything unless they're missing
        # entirely
        el = get_or_create_element(
            submission_xml_root, deployment.FORM_UUID_XPATH
        )
        if not el or not el.text.strip():
            form_uuid = deployment.backend_response['uuid']
            el.text = form_uuid

        el = get_or_create_element(
            submission_xml_root, deployment.SUBMISSION_CURRENT_UUID_XPATH
        )
        if not el or not el.text.strip():
            el.text = 'uuid:' + submission_json['_uuid']

        # Do not use version_uid from the submission until UI gives users the
        # possibility to choose which version they want to use

        # # TODO: un-nest `_infer_version_id()` from `build_formpack()` and move
        # # it into some utility file
        # _, submissions_stream = build_formpack(
        #     self.asset,
        #     submission_stream=[submission_json],
        #     use_all_form_versions=True
        # )
        # version_uid = list(submissions_stream)[0][INFERRED_VERSION_ID_KEY]

        # Let's use the latest **deployed** version uid temporarily
        version_uid = self.asset.latest_deployed_version.uid

        # Retrieve the XML root node name from the submission. The instance's
        # root node name specified in the form XML (i.e. the first child of
        # `<instance>`) must match the root node name of the submission XML,
        # otherwise Enketo will refuse to open the submission.
        xml_root_node_name = submission_xml_root.tag

        # This will raise `AssetVersion.DoesNotExist` if the inferred version
        # of the submission disappears between the call to `build_formpack()`
        # and here, but allow a 500 error in that case because there's nothing
        # the client can do about it
        snapshot = self.asset.snapshot(
            regenerate=True,
            root_node_name=xml_root_node_name,
            version_uid=version_uid,
            submission_uuid=remove_uuid_prefix(submission_json['meta/rootUuid']),
        )

        data = {
            'server_url': reverse(
                viewname='assetsnapshot-detail',
                kwargs={'uid_asset_snapshot': snapshot.uid},
                request=request,
            ),
            'instance': xml_tostring(submission_xml_root),
            'instance_id': submission_json['_uuid'],
            'form_id': snapshot.uid,
            'return_url': 'false'  # String to be parsed by EE as a boolean
        }

        # Add attachments if any.
        attachments = deployment.get_attachment_objects_from_dict(submission_json)
        for attachment in attachments:
            key_ = f'instance_attachments[{attachment.media_file_basename}]'
            data[key_] = reverse(
                'attachment-detail',
                args=(self.asset.uid, submission_id, attachment.uid),
                request=request,
            )

        response = requests.post(
            f'{settings.ENKETO_URL}/{enketo_endpoint}',
            # bare tuple implies basic auth
            auth=(settings.ENKETO_API_KEY, ''),
            data=data
        )
        if response.status_code != status.HTTP_201_CREATED:
            # Some Enketo errors are useful to the client. Attempt to pass them
            # along if possible
            try:
                parsed_resp = response.json()
            except ValueError:
                parsed_resp = None
            if parsed_resp and 'message' in parsed_resp:
                message = parsed_resp['message']
            else:
                message = response.reason
            return Response(
                # This doesn't seem worth translating
                {'detail': 'Enketo error: ' + message},
                status=response.status_code,
            )

        json_response = response.json()
        enketo_url = json_response.get(f'{action_}_url')

        return Response(
            {
                'url': enketo_url,
                'version_uid': version_uid,
            }
        )

    def _handle_enketo_redirect(self, request, enketo_response, *args, **kwargs):
        if request.path.strip('/').split('/')[-2] == 'redirect':
            try:
                enketo_url = enketo_response.data['url']
            except KeyError:
                pass
            else:
                return HttpResponseRedirect(enketo_url)
        return enketo_response
