from datetime import timedelta

import constance
from allauth.account.models import EmailAddress
from allauth.account.signals import email_confirmed
from allauth.account.utils import cleanup_email_addresses
from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.signals import social_account_added
from django.contrib.auth import update_session_auth_hash
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from hub.models import ExtraUserDetail
from ..help.models import InAppMessage, InAppMessageUsers, MessageType
from .models import SocialAppCustomData, SocialAppManagedDomain
from .utils import (
    DEFAULT_IN_APP_MESSAGE_BODY,
    SOCIAL_APP_IDENTIFIER,
    remove_managed_sso_reminders,
    update_or_create_in_app_message,
    user_account_is_managed_by_sso,
)


@receiver(social_account_added)
def update_email(*args, **kwargs):
    sociallogin = kwargs.get('sociallogin')
    request = kwargs.get('request')
    social_email_addresses = sociallogin.email_addresses
    # if the provider doesn't use email, don't bother updating addresses
    if not social_email_addresses:
        return
    social_user = sociallogin.user
    for social_email in social_email_addresses:
        # the auto-created EmailAddresses don't have the user already attached (?!)
        social_email.user = social_user
    existing_email_addresses = list(EmailAddress.objects.filter(user=social_user))
    # put the social email addresses first so they get marked as primary
    all_email_addresses = [*social_email_addresses, *existing_email_addresses]
    emails, primary = cleanup_email_addresses(request, all_email_addresses)

    # cleanup_email_addresses doesn't actually call set_as_primary on the primary
    # email so do that now.
    # If primary has no pk, a matching record may already exist in the DB
    # (e.g. reconnecting an SSO account whose email is already stored).
    # In that case we must reuse the existing row; otherwise set_as_primary()
    # would attempt an INSERT and hit the unique(user_id, email) constraint.
    if not primary.pk:
        try:
            primary = EmailAddress.objects.get(user=social_user, email=primary.email)
        except EmailAddress.DoesNotExist:
            pass
    primary.set_as_primary()

    # update existing emails to reflect that they are no longer primary
    # and add any new emails from the SocialLogin
    EmailAddress.objects.bulk_create(
        emails,
        update_conflicts=True,
        unique_fields=['email','user_id'],
        update_fields=['primary']
    )
    # for some reason allauth doesn't emit the email confirmed signal even
    # though if we're calling the social_account_added signal, the email has been
    # verified
    email_confirmed.send(
        sender=EmailAddress,
        request=request,
        email_address=primary,
    )


@receiver(post_save, sender=SocialAppManagedDomain)
@receiver(post_delete, sender=SocialAppManagedDomain)
@receiver(post_save, sender=SocialAppCustomData)
@receiver(post_delete, sender=SocialAppCustomData)
def sync_managed_sso_email_domains(sender=None, **kwargs):
    """
    Syncs the list of email domains across all managed SocialApps to the
    REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS Constance config setting.
    """
    domains = (
        SocialAppManagedDomain.objects.filter(social_app__managed=True)
        .values_list('domain', flat=True)
        .order_by('domain')
    )
    domain_string = '\n'.join(domains)
    setattr(
        constance.config,
        'REGISTRATION_SSO_MANAGED_EMAIL_DOMAINS',
        domain_string,
    )


@receiver(post_delete, sender=SocialAppCustomData)
def remove_reminders_on_custom_data_delete(sender=None, instance=None, **kwargs):
    """
    Covers a direct deletion and the cascade from deleting the SocialApp.
    """
    remove_managed_sso_reminders(instance.pk)


@receiver(post_delete, sender=SocialAppManagedDomain)
def remove_reminders_on_domain_delete(sender=None, instance=None, **kwargs):
    remove_managed_sso_reminders(instance.social_app_id, domain=instance.domain)


@receiver(post_save, sender=SocialAppCustomData)
def remove_reminders_on_managed_off(sender=None, instance=None, **kwargs):
    if not instance.managed:
        remove_managed_sso_reminders(instance.pk)


@receiver(social_account_added)
def enforce_managed_sso(sender=None, **kwargs):
    sociallogin = kwargs.get('sociallogin')
    request = kwargs.get('request')
    user = sociallogin.user
    incoming = sociallogin.account
    if user_account_is_managed_by_sso(user, incoming):
        app_provider_id = incoming.provider
        app = SocialApp.objects.get(provider_id=app_provider_id)
        InAppMessageUsers.objects.filter(
            user=user,
            in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER,
            in_app_message__generic_related_objects__contains={
                SOCIAL_APP_IDENTIFIER: app.pk
            },
        ).delete()
        now = timezone.now()
        # if all users have linked their accounts, expire the inapp message
        InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER,
            generic_related_objects__contains={SOCIAL_APP_IDENTIFIER: app.pk},
            inappmessageusers__isnull=True,
        ).update(valid_until=now)
        user.set_unusable_password()
        user.save()
        update_session_auth_hash(request, user)


@receiver(post_save, sender=ExtraUserDetail)
def manage_sso_exemption_change(sender=None, instance=None, **kwargs):
    if instance._initially_sso_exempt == instance.sso_exempt:
        return
    user = instance.user
    managing_sso = SocialAppManagedDomain.get_managing_sso(user)
    if not managing_sso:
        return
    now = timezone.now()
    custom_data = SocialAppCustomData.objects.get(social_app=managing_sso)
    # non-exempt became exempt, delete their notification and expire the message if necessary
    if not instance._initially_sso_exempt:
        InAppMessageUsers.objects.filter(
            user=instance.user,
            in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER,
        ).delete()
        InAppMessage.objects.filter(
            message_type=MessageType.MANAGED_SSO_REMINDER,
            generic_related_objects__contains={SOCIAL_APP_IDENTIFIER: managing_sso.pk},
            inappmessageusers__isnull=True,
        ).update(valid_until=now)
        return
    # exempt became non-exempt, either update existing account or, if notifications were requested, notify them
    has_social_account = SocialAccount.objects.filter(
        user=user,
        provider=managing_sso.provider_id,
    ).exists()
    if has_social_account:
        user.set_unusable_password()
        user.save()
    else:
        if custom_data.send_in_app_message:
            existing_message = update_or_create_in_app_message(
                social_app=managing_sso,
                body = custom_data.in_app_message_body or DEFAULT_IN_APP_MESSAGE_BODY
            )
            # this will un-expire the message reminder if it was previously expired after all other users
            # linked their accounts
            existing_message.valid_until = now + timedelta(days=365)
            existing_message.save()
            InAppMessageUsers.objects.create(user=user, in_app_message=existing_message)
