from django.conf import settings
from django.contrib import admin, messages

from .models import EmailStatus, MassEmailConfig, MassEmailRecord
from .tasks import enqueue_mass_email_records


@admin.register(MassEmailConfig)
class MassEmailConfigAdmin(admin.ModelAdmin):

    list_display = ('name', 'date_modified')
    fields = ('name', 'subject', 'template', 'query')
    actions = ['enqueue_mass_emails', 'test_email_config']

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not settings.MASS_EMAIL_ENABLE_TEST_ACTION:
            del actions['test_email_config']
        return actions

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

    @admin.action(
        description='Test configuration (sends 20 emails)'
    )
    def test_email_config(self, request, queryset):
        sender = MassEmailSender()
        for config in queryset:
            if config.jobs.count() == 0:
                enqueue_mass_email_records(config)
            sender.send_day_emails(config_id=config.id, limit_emails=20)
