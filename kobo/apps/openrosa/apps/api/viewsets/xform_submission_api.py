import io
import re

from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status
from rest_framework.authentication import get_authorization_header
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated
from rest_framework.parsers import FormParser, JSONParser
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer
from rest_framework.response import Response

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.data_collectors.authentication import DataCollectorTokenAuthentication
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.mixins.openrosa_headers_mixin import OpenRosaHeadersMixin
from kobo.apps.openrosa.libs.renderers.renderers import TemplateXMLRenderer
from kobo.apps.openrosa.libs.serializers.data_serializer import SubmissionSerializer
from kobo.apps.openrosa.libs.utils.logger_tools import (
    UnauthenticatedEditAttempt,
    dict2xform,
    safe_create_instance,
)
from kobo.apps.openrosa.libs.utils.string import dict_lists2strings
from kobo.apps.openrosa.schema_extensions.v2.submission.examples import (
    get_json_response_openapi_example,
    get_json_submission_openapi_example,
    get_xml_response_openapi_example,
)
from kobo.apps.openrosa.schema_extensions.v2.submission.serializers import (
    JSONSubmissionPayload,
    OpenRosaPayload,
    OpenRosaResponse,
    SubmissionResponse,
)
from kpi.authentication import (
    BasicAuthentication,
    DigestAuthentication,
    SessionAuthentication,
    TokenAuthentication,
)
from kpi.parsers import RawFilenameMultiPartParser
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_201_created_response
from ..utils.rest_framework.viewsets import OpenRosaGenericViewSet
from ..utils.xml import extract_confirmation_message

xml_error_re = re.compile('>(.*)<')


def is_json(request):
    return 'application/json' in request.content_type.lower()


def create_instance_from_xml(username, request):
    xml_file_list = request.FILES.pop('xml_submission_file', [])
    xml_file = xml_file_list[0] if len(xml_file_list) else None
    media_files = request.FILES.values()
    return safe_create_instance(username, xml_file, media_files, None, request=request)


def create_instance_from_json(username, request):
    request.accepted_renderer = JSONRenderer()
    request.accepted_media_type = JSONRenderer.media_type
    dict_form = request.data
    submission = dict_form.get('submission')

    if submission is None:
        # return an error
        return [t('No submission key provided.'), None]

    # convert lists in submission dict to joined strings
    submission_joined = dict_lists2strings(submission)
    xml_string = dict2xform(submission_joined, dict_form.get('id'))

    xml_file = io.StringIO(xml_string)
    return safe_create_instance(username, xml_file, [], None, request=request)


@extend_schema_view(
    create_authenticated=extend_schema(
        description=read_md('openrosa', 'submission/authenticated.md'),
        request={
            'multipart/form-data': OpenRosaPayload,
            'application/json': JSONSubmissionPayload,
        },
        responses={
            **open_api_201_created_response(
                SubmissionResponse,
                media_type='application/json',
                examples=[get_json_response_openapi_example()],
                raise_access_forbidden=False,
            ),
            **open_api_201_created_response(
                OpenRosaResponse,
                media_type='text/xml',
                examples=[get_xml_response_openapi_example()],
                require_auth=False,
                validate_payload=False,
                raise_access_forbidden=False,
                raise_not_found=False,
            ),
        },
        examples=[get_json_submission_openapi_example()],
        tags=['OpenRosa Form Submission'],
        operation_id='submission_authenticated',
    ),
    create_anonymous=extend_schema(
        description=read_md('openrosa', 'submission/anonymous.md'),
        request={
            'multipart/form-data': OpenRosaPayload,
            'application/json': JSONSubmissionPayload,
        },
        responses={
            **open_api_201_created_response(
                SubmissionResponse,
                media_type='application/json',
                examples=[get_json_response_openapi_example()],
                require_auth=False,
                raise_access_forbidden=False,
            ),
            **open_api_201_created_response(
                OpenRosaResponse,
                media_type='text/xml',
                examples=[get_xml_response_openapi_example()],
                require_auth=False,
                validate_payload=False,
                raise_access_forbidden=False,
                raise_not_found=False,
            ),
        },
        examples=[get_json_submission_openapi_example()],
        tags=['OpenRosa Form Submission'],
        operation_id='submission_anonymous',
    ),
    create_data_collector=extend_schema(
        description=read_md('openrosa', 'submission/data_collector.md'),
        request={
            'multipart/form-data': OpenRosaPayload,
            'application/json': JSONSubmissionPayload,
        },
        responses={
            **open_api_201_created_response(
                SubmissionResponse,
                media_type='application/json',
                examples=[get_json_response_openapi_example()],
                require_auth=False,
                raise_access_forbidden=False,
            ),
            **open_api_201_created_response(
                OpenRosaResponse,
                media_type='text/xml',
                examples=[get_xml_response_openapi_example()],
                require_auth=False,
                validate_payload=False,
                raise_access_forbidden=False,
                raise_not_found=False,
            ),
        },
        examples=[get_json_submission_openapi_example()],
        tags=['OpenRosa Form Submission'],
        operation_id='submission_data_collector',
    ),
)
class XFormSubmissionApi(
    OpenRosaHeadersMixin,
    mixins.CreateModelMixin,
    OpenRosaGenericViewSet,
    AuditLoggedViewSet,
):
    """
    ViewSet for managing the enketo submission
    Documentation:
    - docs/api/v2/submission/create.md
    - docs/api/v2/submission/anonymous.md
    - docs/api/v2/submission/authenticated.md
    - docs/api/v2/submission/data_collector.md

    Available actions:
    - create        → POST /submission
    - create        → POST /{username}/submission
    - create        → POST /collector/{token}/submission

    Implements OpenRosa Api [FormSubmissionAPI](\
        https://bitbucket.org/javarosa/javarosa/wiki/FormSubmissionAPI)

    """
    filter_backends = (filters.AnonDjangoObjectPermissionFilter,)
    model = Instance
    permission_classes = (permissions.AllowAny,)
    renderer_classes = (TemplateXMLRenderer, JSONRenderer, BrowsableAPIRenderer)
    serializer_class = SubmissionSerializer
    template_name = 'submission.xml'
    log_type = AuditType.PROJECT_HISTORY
    parser_classes = (
        JSONParser,
        FormParser,
        RawFilenameMultiPartParser,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Respect DEFAULT_AUTHENTICATION_CLASSES, but also ensure that the
        # previously hard-coded authentication classes are included first.
        # We include BasicAuthentication here to allow submissions using basic
        # authentication over unencrypted HTTP. REST framework stops after the
        # first class that successfully authenticates, so
        # HttpsOnlyBasicAuthentication will be ignored even if included by
        # DEFAULT_AUTHENTICATION_CLASSES.
        authentication_classes = [
            DigestAuthentication,
            BasicAuthentication,
            TokenAuthentication,
            # we only need this for the create_data_collector, but since we're setting
            # this in the __init__ we can't set it in the action decorator
            DataCollectorTokenAuthentication,
        ]
        # Do not use `SessionAuthentication`, which implicitly requires CSRF
        # prevention (which in turn requires that the CSRF token be submitted
        # as a cookie and in the body of any "unsafe" requests).
        self.authentication_classes = authentication_classes + [
            auth_class
            for auth_class in self.authentication_classes
            if auth_class not in authentication_classes
            and not issubclass(auth_class, SessionAuthentication)
        ]

    @action(detail=False, methods=['POST'])
    def create_authenticated(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    @action(detail=False, methods=['POST'])
    def create_anonymous(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    @action(detail=False, methods=['POST'])
    def create_data_collector(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        username = self.kwargs.get('username')
        token = self.kwargs.get('token')
        if token:
            username = None
        elif self.request.user.is_anonymous:
            if not username:
                # Authentication is mandatory when username is omitted from the
                # submission URL
                raise NotAuthenticated
            else:
                _ = get_object_or_404(User, username=username.lower())
        elif not username:
            # get the username from the user if not set
            user = get_database_user(request.user)
            username = user.username

        if request.method.upper() == 'HEAD':
            return Response(
                status=status.HTTP_204_NO_CONTENT,
                headers=self.get_openrosa_headers(request),
                template_name=self.template_name,
            )

        # Return 401 if no authentication provided and there are no files,
        # for digest authentication to work properly
        has_auth = bool(get_authorization_header(request))
        if not has_auth and not (bool(request.FILES) or bool(request.data)):
            raise NotAuthenticated

        is_json_request = is_json(request)

        create_instance_func = (
            create_instance_from_json
            if is_json_request
            else create_instance_from_xml
        )
        try:
            error, instance = create_instance_func(username, request)
        except UnauthenticatedEditAttempt:
            # It's important to respond with a 401 instead of a 403 so that
            # digest authentication can work properly
            raise NotAuthenticated
        if error or not instance:
            return self.error_response(error, is_json_request, request)

        context = self.get_serializer_context()
        if instance.xml and (
            confirmation_message := extract_confirmation_message(instance.xml)
        ):
            context['confirmation_message'] = confirmation_message
        serializer = SubmissionSerializer(instance, context=context)

        return Response(serializer.data,
                        headers=self.get_openrosa_headers(request),
                        status=status.HTTP_201_CREATED,
                        template_name=self.template_name)

    def error_response(self, error, is_json_request, request):
        if not error:
            error_msg = t('Unable to create submission.')
            status_code = status.HTTP_400_BAD_REQUEST
        elif isinstance(error, str):
            error_msg = error
            status_code = status.HTTP_400_BAD_REQUEST
        elif not is_json_request:
            return error
        else:
            error_msg = xml_error_re.search(
                error.content.decode('utf-8')
            ).groups()[0]
            status_code = error.status_code

        return Response({'error': error_msg},
                        headers=self.get_openrosa_headers(request),
                        status=status_code)
