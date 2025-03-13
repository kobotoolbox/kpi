from django.contrib import admin, messages

from .models import MassEmailConfig, MassEmailRecord, EmailStatus
from .tasks import enqueue_mass_email_records


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    list_display = ('name', 'date_modified')
    fields = ('name', 'subject', 'template', 'query')
    actions = ['enqueue_mass_emails', 'send_emails']

    @admin.action(description='Add to daily send queue')
    def enqueue_mass_emails(self, request, queryset):
        for config in queryset:
            if MassEmailRecord.objects.filter(
                email_job__email_config=config,
                status=EmailStatus.ENQUEUED,
            ).exists():
                self.message_user(
                    request,
                    f'Emails for {config.name} are already enqueued or being sent',
                    level=messages.ERROR,
                )
                continue

            # Create a job and records for each user
            enqueue_mass_email_records(config)

            self.message_user(
                request,
                f'Emails for {config.name} have been scheduled for tomorrow',
                level=messages.SUCCESS,
            )

    @admin.action(description='Send emails')
    def send_emails(self, request, queryset):
        for email_config in queryset:
            send_emails.delay(email_config.uid, should_create_job=True)
