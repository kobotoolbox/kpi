# coding: utf-8
from django.conf import settings
from django.template import context_processors
from django.utils.translation import gettext as t
from django_digest import HttpDigestAuthenticator
from rest_framework.authentication import (
    BaseAuthentication,
    BasicAuthentication as DRFBasicAuthentication,
    TokenAuthentication as DRFTokenAuthentication,
    SessionAuthentication as DRFSessionAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed
from oauth2_provider.contrib.rest_framework import OAuth2Authentication as OPOAuth2Authentication

from kobo.apps.audit_log.mixins import RequiresAccessLogMixin
from kpi.mixins.mfa import MfaBlockerMixin


class BasicAuthentication(MfaBlockerMixin, DRFBasicAuthentication, RequiresAccessLogMixin):
    """
    Extend DRF class to support MFA.

    Basic authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Basic authentication'

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, creds = result
        self.create_access_log(request, user, 'basic')
        return user, creds

    def authenticate_credentials(self, userid, password, request=None):
        user, _ = super().authenticate_credentials(
            userid=userid, password=password, request=request
        )
        self.validate_mfa_not_active(user)
        return user, _


class DigestAuthentication(MfaBlockerMixin, BaseAuthentication, RequiresAccessLogMixin):

    verbose_name = 'Digest authentication'

    def __init__(self):
        self.authenticator = HttpDigestAuthenticator()

    def authenticate(self, request):

        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b'digest':
            return None

        if self.authenticator.authenticate(request):

            # If user provided correct credentials but their account is
            # disabled, return a 401
            if not request.user.is_active:
                raise AuthenticationFailed()

            self.validate_mfa_not_active(request.user)
            self.create_access_log(request, request.user, 'digest')

            return request.user, None
        else:
            raise AuthenticationFailed(t('Invalid username/password'))

    def authenticate_header(self, request):
        response = self.build_challenge_response()
        return response['WWW-Authenticate']

    def build_challenge_response(self):
        return self.authenticator.build_challenge_response()


class EnketoSessionAuthentication(DRFSessionAuthentication):
    """
    Enketo Express uses `__csrf` as both the cookie from which to read the CSRF
    token and as the field in the POST data where it returns the token when it
    makes requests. By default, Django expects the cookie, to be called
    `csrftoken` and compares this to the value of a HTTP header called
    `X-CSRFToken`. This class handles translating between these expectations.

    See https://github.com/enketo/enketo-express/issues/187.
    """
    def enforce_csrf(self, request, *args, **kwargs):
        """
        Copy the CSRF token from where Enketo sends it in a cookie and the
        POST data into the places expected by Django. Then, call the super-
        class to handle CSRF enforcement.
        """
        enketo_post_data_token = request.POST.get(settings.ENKETO_CSRF_COOKIE_NAME)
        enketo_cookie_token = request.COOKIES.get(settings.ENKETO_CSRF_COOKIE_NAME)
        if enketo_post_data_token and enketo_cookie_token:
            request.META[settings.CSRF_HEADER_NAME] = enketo_post_data_token
            request.COOKIES[settings.CSRF_COOKIE_NAME] = enketo_cookie_token

        return super().enforce_csrf(request, *args, **kwargs)

    @staticmethod
    def prepare_response_with_csrf_cookie(request, response):
        """
        Prepare `response` for use with Enketo's CSRF mechanism by setting
        a special cookie from which Enketo will read the CSRF token and include
        in its POST data.
        """
        csrf_token = context_processors.csrf(request)['csrf_token']
        response.set_cookie(
            key=settings.ENKETO_CSRF_COOKIE_NAME,
            value=csrf_token,
            domain=settings.SESSION_COOKIE_DOMAIN,
            secure=settings.SESSION_COOKIE_SECURE or None,
        )


class SessionAuthentication(DRFSessionAuthentication):
    """
    This class is needed to return 401 responses when authentication fails.

    REST Framework's default SessionAuthentication never returns 401, only 403, because
    it can't fill the WWW-Authenticate header with a valid value in the 401 response.
    As a result, we can't distinguish requests that are not authorized (401 unauthorized)
    and requests for which the user does not have permission (403 forbidden).
    See https://github.com/encode/django-rest-framework/issues/5968#issuecomment-39935282

    Overriding `authenticate_header()` causes DRF to generate 401 responses for
    unauthenticated requests, with the `WWW-Authenticate` header set to the
    value returned by `authenticate_header()`. See
    https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication

    Ideally, 401 responses would return multiple `WWW-Authenticate` headers,
    one for each supported authentication mechanism (session, digest, basic, …)
    See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/WWW-Authenticate
    """

    def authenticate_header(self, request):
        return 'Session'


class TokenAuthentication(MfaBlockerMixin, DRFTokenAuthentication, RequiresAccessLogMixin):
    """
    Extend DRF class to support MFA.

    Token authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Token authentication'

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        self.create_access_log(request, user, 'token')
        return user, token

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key=key)
        self.validate_mfa_not_active(user)
        return user, token


class OAuth2Authentication(OPOAuth2Authentication, RequiresAccessLogMixin):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return result
        user, creds = result
        self.create_access_log(request, user, 'oauth2')
        return user, creds
