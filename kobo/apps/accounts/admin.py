from django.contrib import admin
from allauth.account.models import EmailAddress

from .models import EmailAddressAdmin

admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)
