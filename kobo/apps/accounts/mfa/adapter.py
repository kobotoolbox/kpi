from allauth.mfa.adapter import DefaultMFAAdapter
from allauth.mfa.models import Authenticator
from constance import config

from .utils import is_mfa_deactivation_blocked, user_has_active_mfa


class MfaAdapter(DefaultMFAAdapter):

    def can_delete_authenticator(self, authenticator: Authenticator) -> bool:
        if authenticator.type == Authenticator.Type.TOTP and (
            is_mfa_deactivation_blocked(authenticator.user)
        ):
            return False
        return super().can_delete_authenticator(authenticator)

    def is_mfa_enabled(self, user, types=None) -> bool:
        if not config.MFA_ENABLED:
            return False

        if types is None:
            if user.is_anonymous:
                return False
            # Leftover recovery codes without a TOTP authenticator do not mean
            # MFA is on
            return user_has_active_mfa(user)

        return super().is_mfa_enabled(user, types)

    def get_totp_label(self, user) -> str:
        """Returns the label used for representing the given user in a TOTP QR
        code.
        """
        return f'{config.MFA_ISSUER_NAME}-{user.username}'

    def get_totp_issuer(self) -> str:
        """Returns the TOTP issuer name that will be contained in the TOTP QR
        code.
        """
        return config.MFA_ISSUER_NAME
