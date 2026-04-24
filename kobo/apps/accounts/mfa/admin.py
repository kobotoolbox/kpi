# coding: utf-8
from django.contrib import admin, messages

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
        super().save_model(request, obj, form, change)

    def delete_queryset(self, request, queryset):
        # Trigger custom delete logic during bulk deletion
        for obj in queryset:
            obj.delete()


admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethodsWrapper, MfaMethodsWrapperAdmin)
