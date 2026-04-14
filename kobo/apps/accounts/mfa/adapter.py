from typing import Optional

from allauth.mfa.adapter import DefaultMFAAdapter
from allauth.mfa.models import Authenticator
from constance import config
from django.conf import settings
from django.db import transaction

from .models import MfaMethod, MfaMethodsWrapper


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
        return mfa_active and config.MFA_ENABLED

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
        # If the user has already interacted with the new MFA system then
        # a wrapper already exists and there's no need to migrate
        if MfaMethodsWrapper.objects.filter(user=user, name='app').exists():
            return

        if not mfa_method:
            mfa_method = (
                MfaMethod.objects.filter(name='app', user=user, is_active=True)
                .order_by('is_primary')
                .first()
            )
        # Nothing to migrate
        if not mfa_method:
            return

        authenticators = Authenticator.objects.filter(user_id=user.id)
        # Already migrated
        if authenticators.exists():
            return

        # These db operations must happen atomically
        with transaction.atomic():
            encrypted_secret = self.encrypt(mfa_method.secret)
            totp_authenticator = Authenticator.objects.create(
                user_id=mfa_method.user_id,
                type=Authenticator.Type.TOTP,
                data={'secret': encrypted_secret},
            )
            recovery_codes = Authenticator.objects.create(
                user_id=mfa_method.user_id,
                type=Authenticator.Type.RECOVERY_CODES,
                data={
                    'migrated_codes': [
                        self.encrypt(c) for c in mfa_method.backup_codes
                    ],
                    'used_mask': 0,
                },
            )
            mfa_method_wrapper = MfaMethodsWrapper.objects.create(
                name='app',
                user=user,
                is_active=True,
                totp=totp_authenticator,
                recovery_codes=recovery_codes,
                secret=encrypted_secret,
            )
        return mfa_method_wrapper
