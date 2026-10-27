from functools import partial

from allauth.mfa.models import Authenticator
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from kobo.apps.openrosa.apps.main.models import UserProfile


def sync_profile_mfa_status(user_id: int):
    """
    Set `UserProfile.is_mfa_active` (read by KoboCAT) from the user's TOTP
    authenticator, as it is now
    """
    if Authenticator.objects.filter(
        user_id=user_id, type=Authenticator.Type.TOTP
    ).exists():
        UserProfile.set_mfa_status(user_id=user_id, is_active=True)
    else:
        # Update only: never create a profile for a user being deleted, whose
        # authenticators are removed by cascade
        UserProfile.objects.filter(user_id=user_id).update(is_mfa_active=False)


def _sync_after_commit(user_id: int):
    # The profile lives in the KoboCAT database, which commits separately.
    # Waiting for the KPI transaction to commit keeps a rolled-back MFA change
    # (e.g. activation failing after the TOTP row was created) from reaching
    # KoboCAT. Outside a transaction, this runs immediately
    transaction.on_commit(partial(sync_profile_mfa_status, user_id))


@receiver(post_save, sender=Authenticator)
def sync_profile_on_totp_added(sender, instance, created, **kwargs):
    """
    Keep `UserProfile.is_mfa_active` (read by KoboCAT) in sync with allauth,
    whichever flow added the TOTP authenticator (KPI endpoints, allauth
    headless, admin)
    """
    # Only on creation: allauth saves the authenticator again on every use
    if created and instance.type == Authenticator.Type.TOTP:
        _sync_after_commit(instance.user_id)


@receiver(post_delete, sender=Authenticator)
def sync_profile_on_totp_removed(sender, instance, **kwargs):
    if instance.type == Authenticator.Type.TOTP:
        _sync_after_commit(instance.user_id)
