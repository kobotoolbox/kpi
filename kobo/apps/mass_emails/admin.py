from django.contrib import admin
from import_export_celery.admin_actions import create_export_job_action

from .models import (
    EmailStatus,
    EmailType,
    MassEmailConfig,
    MassEmailQueryParam,
    MassEmailRecord,
)


class MassEmailQueryParamAdminInline(admin.TabularInline):
    model = MassEmailQueryParam


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    inlines = (MassEmailQueryParamAdminInline,)
    list_display = ('name', 'date_modified', 'frequency', 'live')
    fields = ('name', 'subject', 'template', 'query', 'frequency', 'live')
    actions = ['enqueue_mass_emails', 'export_recipient_lists']

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.type == EmailType.ONE_TIME:
            if MassEmailRecord.objects.filter(
                email_job__email_config__id=obj.id, status=EmailStatus.ENQUEUED
            ).exists():
                return ('live',)
        return ()

    # wrap the original method so we can give it a clearer name
    @admin.action(description='Export recipient list')
    def export_recipient_lists(self, request, queryset):
        return create_export_job_action(self, request, queryset)
