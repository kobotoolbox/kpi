# coding: utf-8
from django.template.response import TemplateResponse
from rest_framework import exceptions
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes
from rest_framework.response import Response

from kobo.apps.audit_log.models import AccessLog
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ACCESS_LOG_AUTHORIZED_APP_TYPE
from kpi.models import AuthorizedApplication
from kpi.models.authorized_application import ApplicationTokenAuthentication
from kpi.serializers import AuthorizedApplicationUserSerializer


def home(request):
    return TemplateResponse(request, 'index.html')


def modern_browsers(request):
    return TemplateResponse(request, 'modern_browsers.html')


@api_view(['POST'])
@authentication_classes([ApplicationTokenAuthentication])
def authorized_application_authenticate_user(request):
    """
    Returns a user-level API token when given a valid username and
    password. The request header must include an authorized application key
    """
    if type(request.auth) is not AuthorizedApplication:
        # Only specially-authorized applications are allowed to authenticate
        # users this way
        raise exceptions.PermissionDenied()
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
        'date_joined'
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


# TODO Verify if it's still used
def _wrap_html_pre(content):
    return (
        '<!doctype html><html><body><code><pre>%s</pre></code></body></html>' % content
    )
