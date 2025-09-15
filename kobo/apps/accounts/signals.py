from allauth.account.models import EmailAddress
from allauth.account.signals import email_confirmed
from allauth.account.utils import cleanup_email_addresses
from allauth.socialaccount.signals import social_account_added
from django.dispatch import receiver


@receiver(social_account_added)
def update_email(*args, **kwargs):
    sociallogin = kwargs.get('sociallogin')
    request = kwargs.get('request')
    social_email_addresses = sociallogin.email_addresses
    social_user = sociallogin.user
    for social_email in social_email_addresses:
        # the auto-created EmailAddresses don't have the user already attached (?!)
        social_email.user = social_user
    existing_email_addresses = list(EmailAddress.objects.filter(user=social_user))
    # put the social email addresses first so they get marked as primary
    all_email_addresses = [*social_email_addresses, *existing_email_addresses]
    emails, primary = cleanup_email_addresses(request, all_email_addresses)
    primary.set_as_primary()
    EmailAddress.objects.bulk_create(
        emails,
        update_conflicts=True,
        unique_fields=['email','user_id'],
        update_fields=['primary']
    )
    # for some reason allauth doesn't emit the email confirmed signal even though
    # SocialLogin emails come in already confirmed
    email_confirmed.send(
        sender=EmailAddress,
        request=request,
        email_address=primary,
    )
