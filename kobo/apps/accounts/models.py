import re

import constance
from allauth.account.admin import EmailAddressAdmin as BaseEmailAddressAdmin
from allauth.account.signals import email_confirmed
from django.core.exceptions import ValidationError
from django.db import models
from django.dispatch import receiver

EMAIL_DOMAIN_REGEX = re.compile(r'^[a-zA-Z0-9.-]+\.[a-zA-Z0-9_-]{2,}$')


class EmailContent(models.Model):
    """
    The EmailContent model stores the customized content for the emails.

    Available placeholders:
    ##activate_url## - The activation URL to activate new accounts
    ##user## - The username of the user
    """
    class EmailOptions(models.TextChoices):
        ACTIVATION_EMAIL = (
            'email_confirmation_signup_message',
            'Email Confirmation Signup Message',
        )

    class SectionOptions(models.TextChoices):
        SUBJECT = 'subject', 'Subject'
        SECTION_ONE = 'section_one', 'Section One'
        SECTION_TWO = 'section_two', 'Section Two'

    email_name = models.CharField(
        max_length=120,
        choices=EmailOptions.choices,
        default=None,
    )
    section_name = models.CharField(
        max_length=120,
        choices=SectionOptions.choices,
        default=None,
    )
    content = models.TextField(
        blank=True,
        help_text='Available placeholders:<br/> '
                  '##activate_url## - The activation URL to activate new accounts<br/>'
                  '##user## - The username of the user,'
    )

    class Meta:
        unique_together = ('email_name', 'section_name')


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


class SocialAppCustomData(models.Model):
    """Model for adding custom data fields to a SocialApp. For now, any
    application with customization is treated as a "private" application."""

    social_app = models.OneToOneField(
        'socialaccount.SocialApp',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='custom_data',
    )

    is_public = models.BooleanField(
        default=False, help_text='Display social login on login page'
    )
    managed = models.BooleanField(
        default=False, help_text='Allow clients to manage users exclusively through SSO'
    )

    def __str__(self):
        return f'{self.social_app.name} Custom Data'


def validate_domain(value):
    normalized_value = value.strip().lower()
    if EMAIL_DOMAIN_REGEX.fullmatch(value) is None:
        raise ValidationError(f'Invalid email domain: {value}')
    blacklist_domains = constance.config.REGISTRATION_BLACKLIST_EMAIL_DOMAINS
    blacklist_domain_set = {
        d.strip().lower() for d in blacklist_domains.splitlines() if d.strip()
    }

    if normalized_value in blacklist_domain_set:
        raise ValidationError(f'Cannot manage forbidden email domain: {value}')

    allowed_domains = constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS.strip()
    allowed_domain_list = [
        domain.strip().lower() for domain in allowed_domains.split('\n') if bool(domain)
    ]
    if allowed_domain_list and normalized_value not in allowed_domain_list:
        raise ValidationError(f'Email domain not in allowed domain list {value}')


class SocialAppManagedDomain(models.Model):
    """
    One-to-many model associating email domains with a given SSO provider
    """

    social_app = models.ForeignKey(
        SocialAppCustomData, related_name='domains', on_delete=models.CASCADE
    )
    domain = models.CharField(unique=True, max_length=255, validators=[validate_domain])

    @classmethod
    def is_managed(cls, domain):
        return cls.objects.filter(
            domain__iexact=domain, social_app__managed=True
        ).exists()

    def save(self, *args, **kwargs):
        if self.domain:
            self.domain = self.domain.strip().lower()
        super().save(*args, **kwargs)
