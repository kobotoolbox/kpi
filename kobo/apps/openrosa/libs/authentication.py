# coding: utf-8
from django.conf import settings
from django.utils.translation import gettext as t
from django.http import HttpResponse
from rest_framework.authentication import BasicAuthentication
from rest_framework.exceptions import AuthenticationFailed

from kobo.apps.audit_log.mixins import RequiresAccessLogMixin
from kpi.authentication import DigestAuthentication
from kpi.mixins.mfa import MfaBlockerMixin


def digest_authentication(request):
    authenticator = DigestAuthentication()
    try:
        authentication = authenticator.authenticate(request)
    except AuthenticationFailed as e:
        return HttpResponse(
            str(e),
            content_type=request.headers['content-type'],
            status=AuthenticationFailed.status_code
        )
    else:
        if not authentication:
            return authenticator.build_challenge_response()


class HttpsOnlyBasicAuthentication(MfaBlockerMixin, BasicAuthentication, RequiresAccessLogMixin):
    """
    Extend DRF class to support MFA and authentication over HTTPS only (if
    testing mode is not activated)

    Basic authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Https Basic authentication'

    def authenticate(self, request):
        # The parent class can discern whether basic authentication is even
        # being attempted; if it isn't, we need to gracefully defer to other
        # authenticators
        user_auth = super().authenticate(request)
        if (
            settings.TESTING is False
            and user_auth is not None
            and not request.is_secure()
        ):
            # Scold the user if they provided correct credentials for basic
            # auth but didn't use HTTPS
            raise AuthenticationFailed(t(
                'Using basic authentication without HTTPS transmits '
                'credentials in clear text! You MUST connect via HTTPS '
                'to use basic authentication.'
            ))
        if user_auth is None:
            return None
        user, auth = user_auth
        self.create_access_log(request, user, 'https basic')
        return user_auth

    def authenticate_credentials(self, userid, password, request=None):
        user, auth = super().authenticate_credentials(
            userid=userid, password=password, request=request
        )
        self.validate_mfa_not_active(user)
        return user, auth
