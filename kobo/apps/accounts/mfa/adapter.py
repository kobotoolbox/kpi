from allauth.mfa.adapter import DefaultMFAAdapter
from constance import config

from .permissions import mfa_allowed_for_user
from .models import MfaMethodsWrapper
from ..utils import user_has_inactive_paid_subscription


class MfaAdapter(DefaultMFAAdapter):

    def is_mfa_enabled(self, user, types=None) -> bool:
        mfa_active_super = super().is_mfa_enabled(user, types)
        mfa_active = mfa_active_super and MfaMethodsWrapper.objects.filter(
            user=user, is_active=True).first() is not None
        mfa_allowed = mfa_allowed_for_user(user)
        inactive_subscription = user_has_inactive_paid_subscription(
            user.username
        )
        return mfa_active and (mfa_allowed or inactive_subscription)

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
