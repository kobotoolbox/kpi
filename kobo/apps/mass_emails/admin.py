from django.contrib import admin, messages
from import_export_celery.admin_actions import create_export_job_action

from .models import EmailStatus, EmailType, MassEmailConfig, MassEmailRecord


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    list_display = ('name', 'date_modified', 'frequency', 'live')
    fields = ('name', 'subject', 'template', 'query', 'frequency', 'live')
    actions = ['enqueue_mass_emails', create_export_job_action]

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.type == EmailType.ONE_TIME:
            if MassEmailRecord.objects.filter(
                email_job__email_config__id=obj.id, status=EmailStatus.ENQUEUED
            ).exists():
                return ('live',)
        return ()

    @admin.action(description='Add to daily send queue')
    def enqueue_mass_emails(self, request, queryset):
        for config in queryset:
            if config.type == EmailType.ONE_TIME:
                if config.live:
                    self.message_user(
                        request,
                        f'Emails for {config.name} have already been scheduled',
                        level=messages.ERROR,
                    )
                else:
                    config.live = True
                    config.save()
                    self.message_user(
                        request,
                        f'Emails for {config.name} have been scheduled for tomorrow',
                        level=messages.SUCCESS,
                    )
            else:
                if config.live:
                    self.message_user(
                        request,
                        f'Emails for {config.name} are already part of the daily send',
                        level=messages.ERROR,
                    )
                else:
                    config.live = True
                    config.save()
                    self.message_user(
                        request,
                        f'Emails for {config.name} have been added to the daily send',
                        level=messages.SUCCESS,
                    )
