from allauth.account.admin import EmailAddressAdmin as BaseEmailAddressAdmin
from allauth.account.signals import email_confirmed
from django.db import models
from django.dispatch import receiver


class EmailContent(models.Model):
    """
    The EmailContent model stores the customized content for the emails.

    Available placeholders:
    ##activate_url## - The activation URL to activate new accounts
    ##user## - The username of the user
    """
    class EmailOptions(models.TextChoices):
        ACTIVATION_EMAIL = 'email_confirmation_signup_message', \
            'Email Confirmation Signup Message'

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
        "socialaccount.SocialApp",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="custom_data",
    )

    is_public = models.BooleanField(default=False, help_text='Display social login on login page')

    def __str__(self):
        return f"{self.social_app.name} Custom Data"
