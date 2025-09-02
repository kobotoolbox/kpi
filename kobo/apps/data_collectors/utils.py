import redis.exceptions
from django_redis import get_redis_connection
from shortuuid import ShortUUID

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kpi.deployment_backends.openrosa_utils import create_enketo_links
from kpi.utils.log import logging


def set_data_collector_enketo_links(token: str, xform_ids: list[str]):
    redis_client = get_redis_connection('enketo_redis_main')
    for xform_id in xform_ids:
        # have enketo create hashes and store the token-based urls
        server_url = DC_ENKETO_URL_TEMPLATE.format(token)
        data = {
            'server_url': server_url,
            'form_id': xform_id,
        }
        response = create_enketo_links(data)
        enketo_id = response.json()['enketo_id']
        # replace the enketo hash with a longer one
        new_id = ShortUUID().random(31)
        redis_client.hset(f'or:{server_url}', key=xform_id, value=new_id)
        # move the token-based url info under the new hash
        enketo_url_info = redis_client.hgetall(f'id:{enketo_id}')
        for key, value in enketo_url_info.items():
            redis_client.hset(f'id:{new_id}', key=key, value=value)


def remove_data_collector_enketo_links(token:str, xform_ids: list[str] = None):
    redis_client = get_redis_connection('enketo_redis_main')
    key_url = DC_ENKETO_URL_TEMPLATE.format(token)
    if xform_ids == []:
        return
    if xform_ids is not None:
        # get all enketo hashes for specified xforms
        all_ee_ids = redis_client.hmget(f'or:{key_url}',*xform_ids)
        all_ee_ids = [ee_id.decode('utf-8') for ee_id in all_ee_ids if ee_id is not None]
        # delete the url info under each hash
        if len(all_ee_ids) > 0:
            redis_client.delete(*[f'id:{ee_id}' for ee_id in all_ee_ids ])
            # delete the xform ids from the data collector base url key
            redis_client.hdel(f'or:{key_url}', *xform_ids)
    else:
        # get all enketo hashes for all xforms the DC has access to
        all_entries = redis_client.hgetall(f'or:{key_url}')
        redis_hashes = [
            redis_hash.decode('utf-8') for redis_hash in all_entries.values()
        ]
        if len(redis_hashes) > 0:
            # delete the url info under each hash
            redis_client.delete(*[f'id:{redis_hash}' for redis_hash in redis_hashes])
        # delete the entire entry for the data collector base url key
        redis_client.delete(f'or:{key_url}')


def rename_data_collector_enketo_links(old_token: str, new_token: str):
    redis_client = get_redis_connection('enketo_redis_main')
    old_key_url = DC_ENKETO_URL_TEMPLATE.format(old_token)
    new_key_url = DC_ENKETO_URL_TEMPLATE.format(new_token)
    try:
        redis_client.rename(f'or:{old_key_url}', f'or:{new_key_url}')
    except redis.exceptions.ResponseError:
        logging.warn(f'Attempt to rename non-existent key or:{old_key_url}')
        return
    enketo_ids = redis_client.hgetall(f'or:{new_key_url}')
    for enketo_id in enketo_ids.values():
        enketo_id_str = enketo_id.decode('utf-8')
        redis_client.hset(
            f'id:{enketo_id_str}', key='openRosaServer', value=new_key_url
        )
