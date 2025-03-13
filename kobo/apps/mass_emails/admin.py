from django.contrib import admin

from kpi.exceptions import ExecutionBlockedException
from .models import MassEmailConfig
from .tasks import send_emails


@admin.register(MassEmailConfig)
class MassEmailConfig(admin.ModelAdmin):

    list_display = ('name', 'date_modified')
    fields = ('name', 'subject', 'template', 'query')
    actions = [
        'send_emails',
    ]

    @admin.action(description='Send emails')
    def send_emails(self, request, queryset):
        for email_config in queryset:
            try:
                send_emails.delay(email_config.uid, should_create_job=True)
            except ExecutionBlockedException:
                pass
