# coding: utf-8
from allauth.mfa.base.internal.flows import delete_and_cleanup
from allauth.mfa.models import Authenticator
from constance import config
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.http import HttpRequest
from django.utils.timezone import now

from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.models.abstract_models import AbstractTimeStampedModel


class MfaMethodsWrapper(AbstractTimeStampedModel):
    """
    MFA Methods is a wrapper table that contains references to a TOTP secret
    and recovery codes.
    """

    class Meta:
        verbose_name = 'MFA Registration'
        verbose_name_plural = 'MFA Registrations'
        constraints = (
            models.UniqueConstraint(
                fields=('user', 'name'),
                name='unique_user_method_name',
            ),
        )

    name = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mfa_methods_wrapper',
    )
    secret = models.CharField(max_length=255)  # Leave room for encryption
    totp = models.ForeignKey(
        Authenticator, null=True, on_delete=models.SET_NULL, related_name='+'
    )
    recovery_codes = models.ForeignKey(
        Authenticator, null=True, on_delete=models.SET_NULL, related_name='+'
    )
    is_active = models.BooleanField(default=False)
    date_disabled = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.user.username}: {self.name=} {self.is_active=}'

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if not self.is_active and not self.date_disabled:
            self.date_disabled = now()

        if self.is_active and self.date_disabled:
            self.date_disabled = None

        if update_fields:
            update_fields += ['date_disabled']

        should_sync = update_fields is None or 'is_active' in update_fields
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

        if should_sync:
            # Sync MFA status with UserProfile
            UserProfile.set_mfa_status(user_id=self.user_id, is_active=self.is_active)

    def delete(self, using=None, keep_parents=False):
        if config.SUPERUSER_AUTH_ENFORCEMENT and self.user.is_superuser:
            raise ValidationError(
                f'MFA deletion is disabled for superuser "{self.user.username}" '
                f'while SUPERUSER_AUTH_ENFORCEMENT is active.'

            )

        user_id = self.user_id
        totp_id = self.totp_id
        recovery_codes_id = self.recovery_codes_id

        with kc_transaction_atomic(), transaction.atomic():
            super().delete(using, keep_parents)

            # Sync MFA status with UserProfile
            UserProfile.set_mfa_status(user_id=user_id, is_active=False)

            if totp_id:
                Authenticator.objects.filter(id=totp_id, user_id=user_id).delete()
            if recovery_codes_id:
                Authenticator.objects.filter(
                    id=recovery_codes_id, user_id=user_id
                ).delete()

    def deactivate(self, request: HttpRequest | None = None):
        if config.SUPERUSER_AUTH_ENFORCEMENT and self.user.is_superuser:
            raise ValidationError(
                f'MFA deactivation is disabled for superuser "{self.user.username}" '
                f'while SUPERUSER_AUTH_ENFORCEMENT is active.'

            )
        totp = self.totp
        recovery_codes_id = self.recovery_codes_id

        with kc_transaction_atomic(), transaction.atomic():
            self.is_active = False
            self.save(update_fields=['is_active'])

            if totp:
                if request is not None and getattr(request, 'user', None) == self.user:
                    delete_and_cleanup(request, totp)
                else:
                    Authenticator.objects.filter(
                        id=totp.pk, user_id=self.user_id
                    ).delete()

            if recovery_codes_id:
                Authenticator.objects.filter(
                    id=recovery_codes_id, user_id=self.user_id
                ).delete()

        # Keep the in-memory instance consistent
        self.totp = None
        self.totp_id = None
        self.recovery_codes = None
        self.recovery_codes_id = None
