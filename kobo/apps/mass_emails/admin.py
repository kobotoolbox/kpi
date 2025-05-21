from django.contrib import admin, messages

from .models import EmailStatus, MassEmailConfig, MassEmailRecord, EmailType
from .tasks import enqueue_mass_email_records


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    list_display = ('name', 'date_modified', 'frequency', 'live')
    fields = ('name', 'subject', 'template', 'query', 'frequency', 'live')
    actions = ['enqueue_mass_emails']

    @admin.action(description='Add to daily send queue')
    def enqueue_mass_emails(self, request, queryset):
        for config in queryset:
            if config.live:
                self.message_user(
                    request,
                    f'Emails for {config.name} are already part of the daily send',
                    level=messages.ERROR,
                )
            else:
                config.live = True
                config.save()

            if config.type == EmailType.ONE_TIME:
                self.message_user(
                    request,
                    f'Emails for {config.name} have been scheduled for tomorrow',
                    level=messages.SUCCESS,
                )
            else:
                self.message_user(
                    request,
                    f'Emails for {config.name} have been added to the daily send',
                    level=messages.SUCCESS,
                )
