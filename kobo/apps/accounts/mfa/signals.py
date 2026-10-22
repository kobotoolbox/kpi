from allauth.mfa.models import Authenticator
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from kobo.apps.openrosa.apps.main.models import UserProfile


@receiver(post_save, sender=Authenticator)
def sync_profile_on_totp_added(sender, instance, created, **kwargs):
    """
    Keep `UserProfile.is_mfa_active` (read by KoboCAT) in sync with allauth,
    whichever flow added the TOTP authenticator (KPI endpoints, allauth
    headless, admin)
    """
    # Only on creation: allauth saves the authenticator again on every use
    if created and instance.type == Authenticator.Type.TOTP:
        UserProfile.set_mfa_status(user_id=instance.user_id, is_active=True)


@receiver(post_delete, sender=Authenticator)
def sync_profile_on_totp_removed(sender, instance, **kwargs):
    if instance.type != Authenticator.Type.TOTP:
        return
    # Update only: never create a profile for a user being deleted, whose
    # authenticators are removed by cascade
    UserProfile.objects.filter(user_id=instance.user_id).update(is_mfa_active=False)
