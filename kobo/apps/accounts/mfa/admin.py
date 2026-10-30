# coding: utf-8
from allauth.mfa.models import Authenticator
from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .utils import deactivate_mfa, is_mfa_deactivation_blocked


class MfaAuthenticatorAdmin(admin.ModelAdmin):
    """
    Lists users with MFA turned on, one row per TOTP authenticator. Deleting a
    row turns MFA off for that user (TOTP and recovery codes)

    Registered from `MfaAppConfig.ready()`, in place of allauth's own admin,
    which exposes secrets and would bypass the superuser enforcement.
    """

    search_fields = ('user__username',)
    list_display = ('user', 'created_at', 'last_used_at')
    fields = ('user', 'created_at', 'last_used_at')
    readonly_fields = fields

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .filter(type=Authenticator.Type.TOTP)
            .select_related('user')
        )

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        if obj and is_mfa_deactivation_blocked(obj.user):
            return False
        return super().has_delete_permission(request, obj)

    def delete_model(self, request, obj):
        try:
            deactivate_mfa(obj.user, request=request)
        except ValidationError as e:
            self.message_user(request, e.message, level=messages.ERROR)

    def delete_queryset(self, request, queryset):
        # Go through `deactivate_mfa()` for each user instead of a bulk SQL
        # delete, so recovery codes are removed too and superusers are skipped
        skipped = 0
        for obj in queryset:
            try:
                deactivate_mfa(obj.user, request=request)
            except ValidationError as e:
                skipped += 1
                self.message_user(request, e.message, level=messages.ERROR)
        if skipped:
            self.message_user(
                request,
                f'{skipped} record(s) could not be deleted (see errors above).',
                level=messages.WARNING,
            )
