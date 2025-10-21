# coding: utf-8
from allauth.mfa.models import Authenticator
from django.conf import settings
from django.contrib import admin
from django.db import models
from django.utils.timezone import now
from trench.admin import MFAMethod as TrenchMFAMethod
from trench.admin import MFAMethodAdmin as TrenchMFAMethodAdmin

from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.models.abstract_models import AbstractTimeStampedModel


class MfaAvailableToUser(models.Model):

    class Meta:
        verbose_name = 'per-user availability'
        verbose_name_plural = 'per-user availabilities'
        db_table = 'mfa_mfaavailabletouser'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        # Used to display the user-friendly representation of MfaAvailableToUser
        # objects, especially in Django Admin interface.
        return f'MFA available to user {self.user.username}'


class MfaAvailableToUserAdmin(admin.ModelAdmin):

    search_fields = ('user__username',)
    autocomplete_fields = ['user']
    # To customize list columns, uncomment line below to use instead of string
    # representation of `MfaAvailableToUser` objects
    # list_display = ('user',)


class MfaMethodsWrapper(AbstractTimeStampedModel):
    """
    MFA Methods is a wrapper table that contains references to a TOTP secret and recovery codes.
    """

    class Meta:
        verbose_name = 'MFA Method'
        verbose_name_plural = 'MFA Methods'
        constraints = (
            models.UniqueConstraint(
                fields=("user", "name"),
                name="unique_user_method_name",
            ),
        )

    name = models.CharField(max_length=255)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    secret = models.ForeignKey(Authenticator, null=True, on_delete=models.SET_NULL, related_name='+')
    recovery_codes = models.ForeignKey(Authenticator, null=True, on_delete=models.SET_NULL, related_name='+')
    is_active = models.BooleanField()
    date_disabled = models.DateTimeField(null=True)

    def __str__(self):
        return f'{self.user.username} #{self.user_id} (MFA Method: {self.name})'

    def save(
        self, force_insert=False, force_update=False, using=None, update_fields=None,
    ):
        created = self.pk is None

        if not self.is_active and not self.date_disabled:
            self.date_disabled = now()

        if self.is_active and self.date_disabled:
            self.date_disabled = None

        if update_fields:
            update_fields += ['date_disabled']

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )


class ExtendedTrenchMfaMethod(TrenchMFAMethod, AbstractTimeStampedModel):
    """
    Extend DjangoTrench model to add created, modified and last disabled date
    """

    class Meta:
        verbose_name = 'Trench MFA Method'
        verbose_name_plural = 'Trench MFA Methods'
        db_table = 'mfa_mfamethod'

    date_disabled = models.DateTimeField(null=True)

    def __str__(self):
        return f'{self.user.username} #{self.user_id} (MFA Method: {self.name})'

    def save(
        self, force_insert=False, force_update=False, using=None, update_fields=None,
    ):
        created = self.pk is None

        if not self.is_active and not self.date_disabled:
            self.date_disabled = now()

        if self.is_active and self.date_disabled:
            self.date_disabled = None

        if update_fields:
            update_fields += ['date_disabled']

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

        """
        Update user's profile in KoBoCAT database.
        """
        if not settings.TESTING and not created:
            UserProfile.set_mfa_status(user_id=self.user.pk, is_active=self.is_active)

    def delete(self, using=None, keep_parents=False):
        user_id = self.user.pk
        super().delete(using, keep_parents)

        """
        Update user's profile in KoboCAT database.
        """
        if not settings.TESTING:
            UserProfile.set_mfa_status(user_id=user_id, is_active=False)



class ExtendedTrenchMfaMethodAdmin(TrenchMFAMethodAdmin):

    search_fields = ('user__username',)
    autocomplete_fields = ['user']

    def has_add_permission(self, request, obj=None):
        return False
