from typing import Union

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from taggit.models import Tag

from kpi.constants import PERM_ADD_SUBMISSIONS
from kpi.exceptions import DeploymentNotFound
from kpi.models import Asset, TagUid
from kpi.utils.object_permission import post_assign_perm, post_remove_perm
from kpi.utils.permissions import (
    is_user_anonymous,
)


@receiver(post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    """ Make sure we have a TagUid object for each newly-created Tag """
    if raw or not created:
        return

    # We don't want to create KPI things for OpenRosa models
    if kwargs.get('using') == settings.OPENROSA_DB_ALIAS:  # noqa
        return

    TagUid.objects.get_or_create(tag=instance)


@receiver(post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Update parent's languages if this object is a child of another asset.
    try:
        parent = instance.parent
    except Asset.DoesNotExist:
        # `parent` may exist in DJANGO models cache but not in DB
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
