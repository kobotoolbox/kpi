from allauth.mfa.adapter import DefaultMFAAdapter
from constance import config

from .models import MfaMethodsWrapper


class MfaAdapter(DefaultMFAAdapter):

    def is_mfa_enabled(self, user, types=None) -> bool:
        if not config.MFA_ENABLED:
            return False

        mfa_active_super = super().is_mfa_enabled(user, types)
        return (
            mfa_active_super
            and MfaMethodsWrapper.objects.filter(user=user, is_active=True).exists()
        )

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
