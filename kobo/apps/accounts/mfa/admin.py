# coding: utf-8
from django.contrib import admin

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

    def delete_queryset(self, request, queryset):
        # Trigger custom delete logic during bulk deletion
        for obj in queryset:
            obj.delete()


admin.site.unregister(TrenchMFAMethod)
admin.site.register(MfaMethodsWrapper, MfaMethodsWrapperAdmin)
