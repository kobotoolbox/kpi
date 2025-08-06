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
from kpi.serializers import AuthorizedApplicationUserSerializer
from kpi.serializers.v2.create_user import CreateUserSerializer
from kpi.versioning import APIV2Versioning


@extend_schema(
    tags=['Authorized Applications'],
    exclude=True,
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
