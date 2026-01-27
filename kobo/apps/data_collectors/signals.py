from django.db.models.signals import post_delete, post_save, pre_delete
from django.dispatch import receiver

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.data_collectors.utils import (
    remove_data_collector_enketo_links,
    rename_data_collector_enketo_links,
    set_data_collector_enketo_links,
)
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models import ObjectPermission


@receiver(post_save, sender=DataCollector)
def update_enketo_links(sender, instance, **kwargs):
    group_changed = instance._initial_group_id != instance.group_id
    token_changed = (
        bool(instance._initial_token) and instance._initial_token != instance.token
    )
    remove_all_links = group_changed and instance._initial_group_id is not None
    add_new_links = group_changed and instance.group_id is not None
    if remove_all_links:
        # use _initial_token just in case both the token and the group changed
        token = instance._initial_token
        remove_data_collector_enketo_links(token)
    if add_new_links:
        asset_uids = list(instance.group.assets.values_list('uid', flat=True))
        set_data_collector_enketo_links(instance.token, asset_uids)
    if token_changed and not group_changed:
        rename_data_collector_enketo_links(instance._initial_token, instance.token)
    # now that we may have enketo links, keep track of the token we used to create
    # them so we can remove later if necessary
    instance._initial_token = instance.token
    instance._initial_group_id = instance.group_id


@receiver(pre_delete, sender=DataCollector)
def remove_enketo_links_on_delete_data_collector(sender, instance, **kwargs):
    remove_data_collector_enketo_links(instance.token)


@receiver(pre_delete, sender=DataCollectorGroup)
def remove_enketo_links_on_delete_data_collector_group(sender, instance, **kwargs):
    for data_collector in instance.data_collectors.all():
        remove_data_collector_enketo_links(data_collector.token)


@receiver(post_delete, sender=ObjectPermission)
def remove_enketo_links_on_permission_removed(sender, instance, *args, **kwargs):
    if instance.permission.codename != PERM_MANAGE_ASSET:
        return
    asset = instance.asset
    group = asset.data_collector_group

    if group is not None and group.owner_id == instance.user_id:
        # we have to do this manually instead of using obj.assets.remove()
        # so we can call save() with adjust_content=False
        asset.data_collector_group = None
        asset.save(
            update_fields=['data_collector_group'],
            adjust_content=False,
            create_version=False,
        )
