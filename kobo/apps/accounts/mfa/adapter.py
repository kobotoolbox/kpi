from typing import Optional

from allauth.mfa.adapter import DefaultMFAAdapter
from allauth.mfa.models import Authenticator
from constance import config
from django.conf import settings

from ..utils import user_has_inactive_paid_subscription
from .models import MfaMethod, MfaMethodsWrapper
from .permissions import mfa_allowed_for_user


class MfaAdapter(DefaultMFAAdapter):

    def is_mfa_enabled(self, user, types=None) -> bool:
        # NOTE: This is a temporary thing. We are migrating users to the allauth tables
        # When the migration is done it won't be necessary.
        self.migrate_user(user)
        mfa_active_super = super().is_mfa_enabled(user, types)
        mfa_active = (
            mfa_active_super
            and MfaMethodsWrapper.objects.filter(user=user, is_active=True).first()
            is not None
        )
        mfa_allowed = mfa_allowed_for_user(user)
        inactive_subscription = user_has_inactive_paid_subscription(user.username)
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

    def migrate_user(
        self, user: settings.AUTH_USER_MODEL, mfa_method: MfaMethod = None
    ) -> Optional[MfaMethodsWrapper]:
        """Migrate user MFA data from trench tables to allauth tables"""
        if not mfa_method:
            mfa_method = (
                MfaMethod.objects.filter(name='app', user=user, is_active=True)
                .order_by('is_primary')
                .first()
            )
        if not mfa_method:
            return
        authenticators = Authenticator.objects.filter(user_id=user.id)
        types_ok = {a.type for a in authenticators} == {
            Authenticator.Type.TOTP,
            Authenticator.Type.RECOVERY_CODES,
        }
        # If allauth MFA Authenticators already exist, exit
        if types_ok:
            return
        for authenticator in authenticators:
            authenticator.delete()

        totp_authenticator = Authenticator.objects.create(
            user_id=mfa_method.user_id,
            type=Authenticator.Type.TOTP,
            data={'secret': self.encrypt(mfa_method.secret)},
        )
        recovery_codes = Authenticator.objects.create(
            user_id=mfa_method.user_id,
            type=Authenticator.Type.RECOVERY_CODES,
            data={
                'migrated_codes': [self.encrypt(c) for c in mfa_method.backup_codes],
            },
        )
        mfa_method_wrapper = MfaMethodsWrapper.objects.create(
            name='app',
            user=user,
            is_active=True,
            totp=totp_authenticator,
            recovery_codes=recovery_codes,
        )
        return mfa_method_wrapper
