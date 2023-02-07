from django.contrib import admin

from kobo.apps.accounts.models import EmailContent


class EmailContentView(admin.ModelAdmin):
    list_display = ('email_name', 'section_name')


admin.site.register(EmailContent, EmailContentView)
