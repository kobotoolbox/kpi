from allauth.mfa.adapter import DefaultMFAAdapter
from constance import config
from .permissions import mfa_allowed_for_user


class MfaAdapter(DefaultMFAAdapter):

    def is_mfa_enabled(self, user, types=None) -> bool:
        super_enabled = super().is_mfa_enabled(user, types)
        return super_enabled and mfa_allowed_for_user(user)

    def get_totp_label(self, user) -> str:
        """Returns the label used for representing the given user in a TOTP QR
        code.
        """
        return f'{config.MFA_ISSUER_NAME}:{user.username}'

    def get_totp_issuer(self) -> str:
        """Returns the TOTP issuer name that will be contained in the TOTP QR
        code.
        """
        return config.MFA_ISSUER_NAME
