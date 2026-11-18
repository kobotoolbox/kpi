# coding: utf-8
from allauth.mfa.models import Authenticator
from django.conf import settings
from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel


class MfaMethodsWrapper(AbstractTimeStampedModel):
    """
    Deprecated: no longer read nor written. allauth's `Authenticator` is the
    source of truth for MFA state (see `kobo.apps.accounts.mfa.utils`).

    The model is kept only so its table can be dropped in a later release,
    once this one is deployed everywhere.
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
