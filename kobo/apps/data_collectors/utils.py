import re

import redis.exceptions
from django_redis import get_redis_connection
from shortuuid import ShortUUID

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kpi.deployment_backends.openrosa_utils import create_enketo_links
from kpi.utils.log import logging

URL_REGEX = re.compile(r'https?://(www\.)?(.*)/?')


def get_url_for_enketo_key(initial_url):
    # mimic the regex processing enketo does to urls to make them work as keys
    match = URL_REGEX.match(initial_url)
    stripped_url = match.groups()[1]
    return stripped_url


def get_redis_key_for_token_and_xform(token, xform_id):
    initial_url = DC_ENKETO_URL_TEMPLATE.format(token)
    url_for_key = get_url_for_enketo_key(initial_url)
    return f'or:{url_for_key},{xform_id}'


def get_redis_key_for_enketo_id(enketo_id):
    return f'id:{enketo_id}'


def get_all_redis_entries_for_token(redis_client, token):
    initial_url = DC_ENKETO_URL_TEMPLATE.format(token)
    url_for_key = get_url_for_enketo_key(initial_url)
    keys = redis_client.keys(f'or:{url_for_key},*')
    return [key.decode('utf-8') for key in keys]

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
        key = get_redis_key_for_token_and_xform(token, xform_id)
        redis_client.set(key, value=new_id)
        # move the token-based url info under the new hash
        old_id_key = get_redis_key_for_enketo_id(enketo_id)
        try:
            redis_client.rename(old_id_key, get_redis_key_for_enketo_id(new_id))
        except redis.exceptions.ResponseError:
            logging.warning(f'Attempt to rename non-existent key {old_id_key}')
            return


def remove_data_collector_enketo_links(token:str, xform_ids: list[str] = None):
    redis_client = get_redis_connection('enketo_redis_main')
    if xform_ids == []:
        return
    if xform_ids is not None:
        all_keys = [
            get_redis_key_for_token_and_xform(token, xform_id) for xform_id in xform_ids
        ]
    else:
        # get all enketo redis entries for this token
        all_keys = get_all_redis_entries_for_token(redis_client, token)
        if not all_keys:
            # no entries to rename, nothing to do
            logging.warning(f'No redis entries found for data collector token {token}')
            return
    # get all enketo hashes for relevant xforms
    enketo_ids = []
    for key in all_keys:
        enketo_id = redis_client.get(key)
        if enketo_id:
            enketo_ids.append(enketo_id.decode('utf-8'))
        else:
            logging.warning(f'No redis entry found for key {key}')
    all_keys.extend(
        [get_redis_key_for_enketo_id(enketo_id) for enketo_id in enketo_ids]
    )
    redis_client.delete(*all_keys)


def rename_data_collector_enketo_links(old_token: str, new_token: str):
    redis_client = get_redis_connection('enketo_redis_main')
    new_server_url = DC_ENKETO_URL_TEMPLATE.format(new_token)
    # get all redis keys that use the old token
    all_keys = get_all_redis_entries_for_token(redis_client, old_token)
    if not all_keys:
        logging.warning(f'No redis entries found for data collector token {old_token}')
        return
    for key in all_keys:
        new_key = key.replace(old_token, new_token, 1)
        try:
            redis_client.rename(key, new_key)
            enketo_id = redis_client.get(new_key).decode('utf-8')
            enketo_key = get_redis_key_for_enketo_id(enketo_id)
            # update the server urls to use the new token
            redis_client.hset(enketo_key, 'openRosaServer', new_server_url)
        except redis.exceptions.ResponseError:
            logging.warning(f'Attempt to rename non-existent key {key}')
