# coding: utf-8
from django.utils.translation import gettext as _
from django_digest import HttpDigestAuthenticator
from rest_framework.authentication import (
    BaseAuthentication,
    BasicAuthentication as DRFBasicAuthentication,
    TokenAuthentication as DRFTokenAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed

from kpi.mixins.mfa import MFABlockerMixin


class BasicAuthentication(MFABlockerMixin, DRFBasicAuthentication):
    """
    Extend DRF class to support MFA.

    Basic authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Basic authentication'

    def authenticate_credentials(self, userid, password, request=None):
        user, _ = super().authenticate_credentials(
            userid=userid, password=password, request=request
        )
        self.validate_mfa_not_active(user)
        return user, _


class DigestAuthentication(MFABlockerMixin, BaseAuthentication):

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

            return request.user, None
        else:
            raise AuthenticationFailed(_('Invalid username/password'))

    def authenticate_header(self, request):
        response = self.build_challenge_response()
        return response['WWW-Authenticate']

    def build_challenge_response(self):
        return self.authenticator.build_challenge_response()


class TokenAuthentication(MFABlockerMixin, DRFTokenAuthentication):
    """
    Extend DRF class to support MFA.

    Token authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Token authentication'

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key=key)
        self.validate_mfa_not_active(user)
        return user, token
