from django.contrib import admin
from allauth.account.models import EmailAddress

from .models import EmailAddressAdmin, SocialAppCustomData
from kobo.apps.accounts.models import EmailContent


class EmailContentView(admin.ModelAdmin):
    list_display = ('email_name', 'section_name')


admin.site.register(EmailContent, EmailContentView)
admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)

admin.site.register(SocialAppCustomData)
