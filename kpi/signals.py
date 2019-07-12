# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from taggit.models import Tag

from kobo.apps.hook.models.hook import Hook
from kpi.deployment_backends.kc_access.shadow_models import KCUser, KCToken
from kpi.model_utils import grant_default_model_level_perms
from kpi.models import Asset, Collection, ObjectPermission, TagUid


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
def save_kobocat_user(sender, instance, **kwargs):
    """
    Sync Auth User table between KPI and KC
    """
    if not settings.TESTING:
        KCUser.sync(instance)


@receiver(post_save, sender=Token)
def save_kobocat_token(sender, instance, **kwargs):
    """
    Sync AuthToken table between KPI and KC
    """
    if not settings.TESTING:
        KCToken.sync(instance)


@receiver(post_delete, sender=Token)
def delete_kobocat_token(sender, instance, **kwargs):
    """
    Delete corresponding record from KC AuthToken table
    """
    if not settings.TESTING:
        KCToken.objects.filter(pk=instance.pk).delete()


@receiver(post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    """ Make sure we have a TagUid object for each newly-created Tag """
    if raw or not created:
        return
    TagUid.objects.get_or_create(tag=instance)


@receiver([post_save, post_delete], sender=Hook)
def update_kc_xform_has_kpi_hooks(sender, instance, **kwargs):
    """
    Updates `kc.XForm` instance as soon as Asset.Hook list is updated.
    """
    asset = instance.asset
    if asset.has_deployment:
        asset.deployment.set_has_kpi_hooks()


@receiver(post_delete, sender=Collection)
def post_delete_collection(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted


@receiver(post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
