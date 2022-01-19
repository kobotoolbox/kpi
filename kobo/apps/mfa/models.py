# coding: utf-8
from django.conf import settings
from django.db import models
from django.utils.timezone import now
from trench.models import MFAMethod

from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatUserProfile,
)


class KoboMFAMethod(MFAMethod):
    """
    Extend DjangoTrench model to add created, modified and last disabled date
    """

    class Meta:
        verbose_name = 'MFA Method'
        verbose_name_plural = 'MFA Methods'

    date_created = models.DateTimeField(default=now)
    date_modified = models.DateTimeField(default=now)
    date_disabled = models.DateTimeField(null=True)

    def save(
        self, force_insert=False, force_update=False, using=None, update_fields=None,
    ):
        created = self.pk is None

        if not self.is_active and not self.date_disabled:
            self.date_disabled = now()

        if self.is_active and self.date_disabled:
            self.date_disabled = None

        if not created:
            self.date_modified = now()

        if update_fields:
            update_fields += ['date_modified', 'date_disabled']

        super().save(force_insert, force_update, using, update_fields)

        """
        Update user's profile in KoBoCAT database.
        """
        if not settings.TESTING and not created:
            KobocatUserProfile.set_mfa_status(
                user_id=self.user.pk, is_active=self.is_active
            )

    def delete(self, using=None, keep_parents=False):
        user_id = self.user.pk
        super().delete(using, keep_parents)

        """
        Update user's profile in KoBoCAT database.
        """
        if not settings.TESTING:
            KobocatUserProfile.set_mfa_status(
                user_id=user_id, is_active=False
            )
