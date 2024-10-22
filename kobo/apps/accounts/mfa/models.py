# coding: utf-8
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


class MfaMethod(TrenchMFAMethod, AbstractTimeStampedModel):
    """
    Extend DjangoTrench model to add created, modified and last disabled date
    """

    class Meta:
        verbose_name = 'MFA Method'
        verbose_name_plural = 'MFA Methods'

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

        super().save(force_insert, force_update, using, update_fields)

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


class MfaMethodAdmin(TrenchMFAMethodAdmin):

    search_fields = ('user__username',)
    autocomplete_fields = ['user']

    def has_add_permission(self, request, obj=None):
        return False
