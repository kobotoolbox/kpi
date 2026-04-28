# coding: utf-8
from constance import config
from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .models import (
    MfaMethodsWrapper,
    TrenchMFAMethod,
)


class MfaMethodsWrapperAdmin(admin.ModelAdmin):
    search_fields = ('user__username',)
    autocomplete_fields = ('user',)
    list_display = ('user', 'is_active', 'date_modified', 'date_disabled')
    exclude = ('name', 'secret', 'totp', 'recovery_codes')
    readonly_fields = ('user', 'date_created', 'date_modified', 'date_disabled')
    fields = ('user', 'date_created', 'date_modified', 'date_disabled', 'is_active')

    def has_add_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj and not obj.is_active:
            readonly_fields.append('is_active')
        return readonly_fields

    def save_model(self, request, obj, form, change):
        changed_data = getattr(form, 'changed_data', [])
        if change and 'is_active' in changed_data and not obj.is_active:
            obj.deactivate()
            return
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):

        if obj and obj.user.is_superuser and config.SUPERUSER_AUTH_ENFORCEMENT:
            return False
        return super().has_delete_permission(request, obj)

    def delete_queryset(self, request, queryset):
        skipped = 0
        for obj in queryset:
            try:
                obj.delete()
            except ValidationError as e:
                skipped += 1
                self.message_user(request, e.message, level=messages.ERROR)
        if skipped:
            self.message_user(
                request,
                f'{skipped} record(s) could not be deleted (see errors above).',
                level=messages.WARNING,
            )


admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethodsWrapper, MfaMethodsWrapperAdmin)
