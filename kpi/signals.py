from typing import Union

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from taggit.models import Tag

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.hook.models.hook import Hook
from kpi.constants import PERM_ADD_SUBMISSIONS
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatToken,
    KobocatUser,
)
from kpi.deployment_backends.kc_access.utils import (
    grant_kc_model_level_perms,
    kc_transaction_atomic,
)
from kpi.exceptions import DeploymentNotFound
from kpi.models import Asset, TagUid
from kpi.utils.object_permission import post_assign_perm, post_remove_perm
from kpi.utils.permissions import (
    grant_default_model_level_perms,
    is_user_anonymous,
)


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
            KobocatUser.sync(instance)
            if created:
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
    Updates KoBoCAT XForm instance as soon as Asset.Hook list is updated.
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


@receiver(post_assign_perm, sender=Asset)
def post_assign_asset_perm(
    sender,
    instance,
    user: Union[settings.AUTH_USER_MODEL, 'AnonymousUser'],
    codename: str,
    **kwargs
):

    if not (is_user_anonymous(user) and codename == PERM_ADD_SUBMISSIONS):
        return

    try:
        instance.deployment.set_enketo_open_rosa_server(require_auth=False)
    except DeploymentNotFound:
        return


@receiver(post_remove_perm, sender=Asset)
def post_remove_asset_perm(
    sender,
    instance,
    user: Union[settings.AUTH_USER_MODEL, 'AnonymousUser'],
    codename: str,
    **kwargs
):

    if not (is_user_anonymous(user) and codename == PERM_ADD_SUBMISSIONS):
        return

    try:
        instance.deployment.set_enketo_open_rosa_server(require_auth=True)
    except DeploymentNotFound:
        return
