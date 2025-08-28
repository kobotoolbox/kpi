from django_redis import get_redis_connection

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE


def remove_data_collector_enketo_links(token:str, xform_ids: list[str] = None):
    redis_client = get_redis_connection('enketo_redis_main')
    key_url = DC_ENKETO_URL_TEMPLATE.format(token)
    if xform_ids is not None:
        for xform_id in xform_ids:
            redis_hash = redis_client.hgetdel(f'or:{key_url}', xform_id)
            redis_client.delete(f'id:{redis_hash}')
    else:
        all_xform_ids = redis_client.hgetall(f'or:{key_url}')
        for xform_id, redis_hash in all_xform_ids.items():
            redis_client.delete(f'id:{redis_hash}')
        redis_client.delete(key_url)

