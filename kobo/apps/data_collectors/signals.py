from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from kobo.apps.data_collectors.models import DataCollector
from kobo.apps.data_collectors.utils import (
    remove_data_collector_enketo_links,
    rename_data_collector_enketo_links,
    set_data_collector_enketo_links,
)


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


@receiver(pre_delete, sender=DataCollector)
def remove_enketo_links_on_delete(sender, instance, **kwargs):
    remove_data_collector_enketo_links(instance.token)
