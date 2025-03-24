from django.contrib import admin, messages

from .models import EmailStatus, MassEmailConfig, MassEmailRecord
from .tasks import enqueue_mass_email_records


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    list_display = ('name', 'date_modified')
    fields = ('name', 'subject', 'template', 'query')
    actions = ['enqueue_mass_emails']

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
