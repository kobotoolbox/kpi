# coding: utf-8
from rest_framework.authentication import (
    BasicAuthentication as DRFBasicAuthentication,
    TokenAuthentication as DRFTokenAuthentication,
)

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
