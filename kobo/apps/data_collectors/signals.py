from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django_redis import get_redis_connection

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.models import DataCollector


def update_links(sender, instance, **kwargs):
    group_changed = instance._initial_group_id != instance.group_id
    token_changed = instance._initial_token and instance._initial_token != instance.token
    remove_all_links = group_changed and instance._initial_group_id is not None
    add_new_links = group_changed and instance.group_id is not None
    rename_links = token_changed
    redis_client = get_redis_connection('enketo_redis_main')
    if remove_all_links:
        # use _initial_token just in case both the token and the group changed
        key_url = DC_ENKETO_URL_TEMPLATE.format(instance._initial_token)
        all_xform_ids = redis_client.hgetall(f'or:{key_url}')
        for _, enketo_hash in all_xform_ids.items():
            redis_client.delete(f'id:{enketo_hash}')
        redis_client.delete()
    elif add_new_links:
        assets = instance.group.assets.all()


    redis_client = get_redis_connection('enketo_redis_main')
    initial_key_url = DC_ENKETO_URL_TEMPLATE.format(instance._initial_token)
    new_key_url = DC_ENKETO_URL_TEMPLATE.format(instance.token)
    redis_client.rename(f'or:{initial_key_url}', f'or:{new_key_url}')

@receiver(pre_delete, sender=DataCollector)
def remove_links_on_delete(sender, instance, **kwargs):
    pass
