from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import exceptions, mixins, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from kobo.apps.audit_log.models import AccessLog
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ACCESS_LOG_AUTHORIZED_APP_TYPE
from kpi.models import AuthorizedApplication
from kpi.models.authorized_application import ApplicationTokenAuthentication
from kpi.schema_extensions.v2.authorized_applications.serializers import \
    AuthenticateResponse, AuthenticatePayload
from kpi.serializers import AuthorizedApplicationUserSerializer
from kpi.serializers.v2.create_user import CreateUserSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_201_created_response
from kpi.versioning import APIV2Versioning


@extend_schema(
    tags=['Authorized Applications']
)
@extend_schema_view(
    authenticate_user=extend_schema(
        description=read_md(
            'kpi', 'authorized_applications/authenticate_user.md'
        ),
        request={'application/json': AuthenticatePayload},
        responses=open_api_201_created_response(
            AuthenticateResponse,
            raise_not_found=False,
        )
    ),
    create=extend_schema(
        description=read_md('kpi', 'authorized_applications/create.md'),
        request={'application/json': CreateUserSerializer},
        responses=open_api_201_created_response(
            CreateUserSerializer,
            raise_not_found=False,
        )
    )
)
class AuthorizedApplicationUserViewSet(
    mixins.CreateModelMixin, viewsets.GenericViewSet
):
    authentication_classes = [ApplicationTokenAuthentication]
    queryset = User.objects.all()
    serializer_class = CreateUserSerializer
    lookup_field = 'username'
    versioning_class = APIV2Versioning
    renderer_classes = [
        JSONRenderer,
    ]
    """
    ViewSet for managing the authorized applications

    Available actions:
    - authenticate_user         → GET /api/v2/authorized-application/authenticate_user/
    - authenticate_user         → GET /api/v2/authorized-application/users/authenticate_user/ (an alias of the first endpoint)  # noqa
    - create                    → GET /api/v2/authorized-application/users/

    Documentation:
    - docs/api/v2/authorized_applications/authenticate_user.md
    - docs/api/v2/authorized_applications/create.md
    """

    @action(detail=False, methods=['POST'])
    def authenticate_user(self, request):

        self._validate_auth(request)

        serializer = AuthorizedApplicationUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise exceptions.PermissionDenied()
        if not user.is_active or not user.check_password(password):
            raise exceptions.PermissionDenied()
        token = Token.objects.get_or_create(user=user)[0]
        response_data = {'token': token.key}
        user_attributes_to_return = (
            'username',
            'first_name',
            'last_name',
            'email',
            'is_staff',
            'is_active',
            'is_superuser',
            'last_login',
            'date_joined',
        )
        for attribute in user_attributes_to_return:
            response_data[attribute] = getattr(user, attribute)
        # usually we would do this at the authentication level but because this is
        # authenticated as the application and not the user, we do it here so
        # we can have the user information
        extra_metadata_for_log = {'authorized_app_name': request.auth.name}
        AccessLog.create_from_request(
            request, user, ACCESS_LOG_AUTHORIZED_APP_TYPE, extra_metadata_for_log
        )
        return Response(response_data)

    def create(self, request, *args, **kwargs):
        self._validate_auth(request)
        return super().create(request, *args, **kwargs)

    def _validate_auth(self, request):
        if type(request.auth) is not AuthorizedApplication:
            # Only specially-authorized applications are allowed to create
            # users via this endpoint
            raise exceptions.PermissionDenied()
