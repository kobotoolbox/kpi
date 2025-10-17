from allauth.mfa.adapter import DefaultMfaAdapter
from .permissions import mfa_allowed_for_user


class MfaAdapter(DefaultMfaAdapter):

    def is_mfa_enabled(self, user, types=None) -> bool:
        super_enabled = super().is_mfa_enabled(user, types)
        return super_enabled and mfa_allowed_for_user(user)
