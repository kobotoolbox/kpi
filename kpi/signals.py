# coding: utf-8
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from taggit.models import Tag

from kobo.apps.hook.models.hook import Hook
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatToken,
    KobocatUser,
)
from kpi.deployment_backends.kc_access.utils import grant_kc_model_level_perms
from kpi.models import Asset, TagUid
from kpi.utils.permissions import grant_default_model_level_perms


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
    grant all KoBoCAT model-level permissions for the content types listed in
    `settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES`
    """
    if not settings.TESTING:
        KobocatUser.sync(instance)

        if created:
            # FIXME: If this fails, the next attempt results in
            #   IntegrityError: duplicate key value violates unique constraint
            #   "auth_user_username_key"
            # and decorating this function with `transaction.atomic` doesn't
            # seem to help. We should roll back the KC user creation if
            # assigning model-level permissions fails
            grant_kc_model_level_perms(instance)


@receiver(post_save, sender=Token)
def save_kobocat_token(sender, instance, **kwargs):
    """
    Sync AuthToken table between KPI and KC
    """
    if not settings.TESTING:
        KobocatToken.sync(instance)


@receiver(post_delete, sender=Token)
def delete_kobocat_token(sender, instance, **kwargs):
    """
    Delete corresponding record from KC AuthToken table
    """
    if not settings.TESTING:
        try:
            KobocatToken.objects.get(pk=instance.pk).delete()
        except KobocatToken.DoesNotExist:
            pass


@receiver(post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    """ Make sure we have a TagUid object for each newly-created Tag """
    if raw or not created:
        return
    TagUid.objects.get_or_create(tag=instance)


@receiver(post_save, sender=Hook)
def update_kc_xform_has_kpi_hooks(sender, instance, **kwargs):
    """
    Updates `kc.XForm` instance as soon as Asset.Hook list is updated.
    """
    asset = instance.asset
    if asset.has_deployment:
        asset.deployment.set_has_kpi_hooks()


@receiver(post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Update parent's languages if this object is a child of another asset.
    try:
        parent = instance.parent
    except Asset.DoesNotExist:  # `parent` may exists in DJANGO models cache but not in DB
        pass
    else:
        if parent:
            parent.update_languages()
