from allauth.account.admin import EmailAddressAdmin as BaseEmailAddressAdmin
from allauth.account.signals import email_confirmed
from django.contrib.auth.models import User
from django.db import models
from django.dispatch import receiver


class EmailAddressAdmin(BaseEmailAddressAdmin):

    search_fields = ('user__username',)
    autocomplete_fields = ['user']


class ImportedVerification(models.Model):
    """
    Temporary model indicating the email address is imported from django-registration
    and is not truely verified.
    Is it Summer 2023 or later? Delete me please.
    Also modify the initial migration to not create these.
    """

    email = models.OneToOneField(
        'account.EmailAddress',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='+',
    )


@receiver(email_confirmed)
def on_email_confirmed(sender, **kwargs):
    """Confirmed email should always replace primary"""
    email_address = kwargs['email_address']
    if not email_address.primary:
        email_address.set_as_primary()
    email_address.user.emailaddress_set.filter(primary=False).delete()
