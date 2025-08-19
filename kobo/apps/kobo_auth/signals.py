from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kpi.deployment_backends.kc_access.utils import (
    grant_kc_model_level_perms,
    kc_transaction_atomic,
)
from kpi.utils.permissions import grant_default_model_level_perms, is_user_anonymous


@receiver(post_save, sender=User)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if is_user_anonymous(instance):
        return

    if created:
        Token.objects.get_or_create(user_id=instance.pk)


@receiver(post_save, sender=User)
def create_organization(sender, instance, created, raw, **kwargs):
    """
    Create organization for user
    """
    user = instance
    if created:
        # calling the property will create the organization if it does not exist.
        user.organization


@receiver(post_save, sender=User)
def default_permissions_post_save(sender, instance, created, raw, **kwargs):
    """
    Users must have both model-level and object-level permissions to satisfy
    DRF, so assign the newly-created user all available collection and asset
    permissions at the model level
    """
    if raw:
        # `raw` means we can't touch (so make sure your fixtures include
        # all necessary permissions!)
        return
    if not created:
        # We should only grant default permissions when the user is first
        # created
        return
    grant_default_model_level_perms(instance)


@receiver(post_save, sender=User)
def save_kobocat_user(sender, instance, created, raw, **kwargs):
    """
    Sync auth_user table between KPI and KC, and, if the user is newly created,
    grant all KoboCAT model-level permissions for the content types listed in
    `settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES`
    """

    if not settings.TESTING:
        with kc_transaction_atomic():
            instance.sync_to_openrosa_db()
            if created:
                grant_kc_model_level_perms(instance)
                UserProfile.objects.get_or_create(user=instance)
