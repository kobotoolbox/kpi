# coding: utf-8
from rest_framework.authentication import (
    BasicAuthentication as DRFBasicAuthentication,
    TokenAuthentication as DRFTokenAuthentication,
)

from kpi.mixins.mfa import MFABlockerMixin


class BasicAuthentication(MFABlockerMixin, DRFBasicAuthentication):

    verbose_name = 'Basic authenfication'

    def authenticate_credentials(self, userid, password, request=None):
        """
        Extend DRF class to support MFA.

        Basic authentication must be deactivated if user has activated MFA
        on their account.
        """
        user, _ = super().authenticate_credentials(
            userid=userid, password=password, request=request
        )
        self.validate_mfa_not_active(user)
        return user, _


class TokenAuthentication(MFABlockerMixin, DRFTokenAuthentication):

    verbose_name = 'Token authenfication'

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key=key)
        self.validate_mfa_not_active(user)
        return user, token
