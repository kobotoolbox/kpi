import re

import redis.exceptions
from django.contrib.postgres.aggregates import ArrayAgg
from django_redis import get_redis_connection
from shortuuid import ShortUUID

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.models import DataCollectorGroup
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.utils.viewer_tools import EnketoError
from kpi.deployment_backends.openrosa_utils import (
    fetch_enketo_links,
    to_internal_or_external_url,
)
from kpi.utils.log import logging


def get_url_for_enketo_key(initial_url):
    # mimic the regex processing enketo does to urls to make them work as keys
    url_regex = re.compile(r'https?://(www\.)?(.*)/?')
    match = url_regex.match(initial_url)
    stripped_url = match.groups()[1]
    return stripped_url


def get_redis_key_for_token_and_xform(token, xform_id_string):
    initial_url = DC_ENKETO_URL_TEMPLATE.format(token)
    url_for_key = get_url_for_enketo_key(initial_url)
    return f'or:{url_for_key},{xform_id_string}'


def get_redis_key_for_enketo_id(enketo_id):
    return f'id:{enketo_id}'


def get_xform_id_strings_by_asset_uid(asset_uids) -> dict[str, str]:
    """
    Map the UID of each deployed asset to the `id_string` of its XForm

    Enketo links use the XForm `id_string`, which is not always the asset UID:
    a redeployment keeps the `id_string` of the first deployment.
    """

    # XForm lives in the KoboCAT database. Evaluate `asset_uids` first so that
    # a KPI queryset never ends up as a subquery in a KoboCAT query.
    asset_uids = list(asset_uids)
    return dict(
        XForm.objects.filter(kpi_asset_uid__in=asset_uids).values_list(
            'kpi_asset_uid', 'id_string'
        )
    )


def get_xform_id_strings_for_group(group_id: str) -> list[str]:
    """
    Return the XForm `id_string` of each deployed asset in the data collector
    group
    """

    asset_uids = DataCollectorGroup.objects.filter(pk=group_id).values_list(
        'assets__uid', flat=True
    )
    return list(get_xform_id_strings_by_asset_uid(asset_uids).values())


def toggle_internal_external_open_rosa_server_for_all_data_collectors():
    redis_client = get_redis_connection('enketo_redis_main')
    # scanning redis for all keys in the data collector format is an O(n)
    # operation on at minimum all xforms currently accepting submissions,
    # so construct the redis keys that are *supposed* to be there from the DB objects
    data_collector_groups = list(
        DataCollectorGroup.objects.filter(
            assets__isnull=False, data_collectors__isnull=False
        )
        .values('uid')
        .annotate(
            asset_uids=ArrayAgg('assets__uid', distinct=True),
            tokens=ArrayAgg('data_collectors__token', distinct=True),
        )
    )
    xform_id_strings = get_xform_id_strings_by_asset_uid(
        {uid for dcg in data_collector_groups for uid in dcg['asset_uids']}
    )

    # should be one redis entry per data collector per deployed asset
    tokens_and_keys = []
    for dcg in data_collector_groups:
        for asset_uid in dcg['asset_uids']:
            if not (xform_id_string := xform_id_strings.get(asset_uid)):
                continue
            for token in dcg['tokens']:
                key = get_redis_key_for_token_and_xform(token, xform_id_string)
                tokens_and_keys.append((token, key))

    if not tokens_and_keys:
        return

    enketo_id_values = redis_client.mget(*[key for _, key in tokens_and_keys])
    # read the constance setting once, not once per link
    server_url_template = to_internal_or_external_url(
        DC_ENKETO_URL_TEMPLATE, openrosa=True
    )
    pipeline = redis_client.pipeline()
    for (token, _), enketo_id_bytes in zip(tokens_and_keys, enketo_id_values):
        if enketo_id_bytes is None:
            continue
        pipeline.hset(
            get_redis_key_for_enketo_id(enketo_id_bytes.decode('utf-8')),
            'openRosaServer',
            server_url_template.format(token),
        )
    pipeline.execute()


def set_data_collector_enketo_links(token: str, xform_id_strings: list[str]):
    redis_client = get_redis_connection('enketo_redis_main')
    for xform_id_string in xform_id_strings:
        # have enketo create hashes and store the token-based urls
        server_url = DC_ENKETO_URL_TEMPLATE.format(token)
        data = {
            'server_url': server_url,
            'form_id': xform_id_string,
        }
        links = fetch_enketo_links(data)
        try:
            enketo_id = links['enketo_id']
        except KeyError as e:
            raise EnketoError('No enketo_id present in enketo response') from e
        # replace the enketo hash with a longer one
        new_id = ShortUUID().random(31)
        key = get_redis_key_for_token_and_xform(token, xform_id_string)
        redis_client.set(key, value=new_id)
        # move the token-based url info under the new hash
        old_id_key = get_redis_key_for_enketo_id(enketo_id)
        try:
            redis_client.rename(old_id_key, get_redis_key_for_enketo_id(new_id))
        except redis.exceptions.ResponseError as e:
            # reraise the redis error with a more helpful message
            raise redis.exceptions.ResponseError(
                'Attempt to rename non-existent' f' key {old_id_key}'
            ) from e
        # Enketo stored the public URL, let it call the internal one instead
        redis_client.hset(
            get_redis_key_for_enketo_id(new_id),
            'openRosaServer',
            to_internal_or_external_url(server_url),
        )


def remove_data_collector_enketo_links(token: str, xform_id_strings: list[str]):
    """
    Remove the Enketo links of the data collector token for the given XForms
    """

    if not xform_id_strings:
        return

    redis_client = get_redis_connection('enketo_redis_main')
    or_keys = [
        get_redis_key_for_token_and_xform(token, xform_id_string)
        for xform_id_string in xform_id_strings
    ]
    id_keys = []
    for or_key, enketo_id in zip(or_keys, redis_client.mget(or_keys)):
        if enketo_id is None:
            logging.warning(f'No redis entry found for key {or_key}')
            continue
        id_keys.append(get_redis_key_for_enketo_id(enketo_id.decode('utf-8')))
    redis_client.delete(*or_keys, *id_keys)


def rename_data_collector_enketo_links(
    old_token: str, new_token: str, xform_id_strings: list[str]
):
    """
    Move the Enketo links of the given XForms from the old data collector token
    to the new one
    """

    if not xform_id_strings:
        return

    redis_client = get_redis_connection('enketo_redis_main')
    old_keys = [
        get_redis_key_for_token_and_xform(old_token, xform_id_string)
        for xform_id_string in xform_id_strings
    ]
    new_server_url = to_internal_or_external_url(
        DC_ENKETO_URL_TEMPLATE.format(new_token)
    )
    pipeline = redis_client.pipeline()
    for xform_id_string, old_key, enketo_id in zip(
        xform_id_strings, old_keys, redis_client.mget(old_keys)
    ):
        if enketo_id is None:
            logging.warning(f'Attempt to rename non-existent key {old_key}')
            continue
        pipeline.rename(
            old_key, get_redis_key_for_token_and_xform(new_token, xform_id_string)
        )
        # update the server url to use the new token
        pipeline.hset(
            get_redis_key_for_enketo_id(enketo_id.decode('utf-8')),
            'openRosaServer',
            new_server_url,
        )
    # a key removed after the MGET makes its RENAME fail, not the whole pipeline
    for result in pipeline.execute(raise_on_error=False):
        if isinstance(result, redis.exceptions.ResponseError):
            logging.warning(f'Could not rename data collector Enketo link: {result}')
