import requests
from django.conf import settings
from django_redis import get_redis_connection
from shortuuid import ShortUUID

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE


def set_data_collector_enketo_links(tokens: list[str], xform_ids: list[str]):
    redis_client = get_redis_connection('enketo_redis_main')
    for token in tokens:
        for xform_id in xform_ids:
            server_url = DC_ENKETO_URL_TEMPLATE.format(token)
            data = {
                'server_url': server_url,
                'form_id': xform_id,
            }
            response = requests.post(
                f'{settings.ENKETO_URL}/{settings.ENKETO_SURVEY_ENDPOINT}',
                auth=(settings.ENKETO_API_KEY, ''),
                data=data,
            )
            enketo_id = response.json()['enketo_id']
            new_id = ShortUUID().random(32)
            redis_client.hset(f'or:{server_url}', key=xform_id, value=new_id)
            current_stash = redis_client.hgetall(f'id:{enketo_id}')
            for key, value in current_stash.items():
                redis_client.hset(f'id:{new_id}', key=key, value=value)

def remove_data_collector_enketo_links(token:str, xform_ids: list[str] = None):
    redis_client = get_redis_connection('enketo_redis_main')
    key_url = DC_ENKETO_URL_TEMPLATE.format(token)
    if xform_ids is not None:
        all_ee_ids = redis_client.hmget(f'or:{key_url}',*xform_ids)
        all_ee_ids = [ee_id.decode('utf-8') for ee_id in all_ee_ids if ee_id is not None]
        redis_client.delete(*[f'id:{ee_id}' for ee_id in all_ee_ids ])
        redis_client.hdel(f'or:{key_url}', *xform_ids)
    else:
        all_xform_ids = redis_client.hgetall(f'or:{key_url}')
        for xform_id, redis_hash in all_xform_ids.items():
            redis_client.delete(f'id:{redis_hash}')
        redis_client.delete(key_url)

