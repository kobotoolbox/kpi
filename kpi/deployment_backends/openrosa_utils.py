from contextlib import contextmanager
from typing import Generator
from urllib.parse import urlparse

import redis.exceptions
import requests
from constance import config
from django.conf import settings
from django_redis import get_redis_connection
from redis.client import Pipeline

from kpi.constants import ENKETO_URL_FORMATS
from kpi.utils.log import logging


@contextmanager
def enketo_redis_transaction() -> Generator[Pipeline, None, None]:
    """
    Queue Enketo Redis commands and send them all at once in a MULTI/EXEC
    block when the context exits.

    Commands only run on exit, so their errors are raised there, not when
    they are queued.
    """

    pipeline = get_redis_connection('enketo_redis_main').pipeline(transaction=True)
    try:
        yield pipeline
        results = pipeline.execute(raise_on_error=False)
    finally:
        pipeline.reset()

    for result in results:
        # Renaming a missing key is not an error, see `rename_enketo_id_key()`
        if isinstance(result, redis.exceptions.ResponseError) and (
            'no such key' in str(result)
        ):
            continue
        if isinstance(result, Exception):
            raise result


# separated out for easier mocking/testing
def fetch_enketo_links(data: dict) -> dict:
    """
    Ask Enketo, through `ENKETO_INTERNAL_URL`, to create the survey links and
    return them with the public `ENKETO_URL` so the internal host never leaks.

    Return an empty dict if Enketo is unreachable or its response is invalid
    """

    try:
        response = requests.post(
            f'{settings.ENKETO_INTERNAL_URL}/{settings.ENKETO_SURVEY_ENDPOINT}',
            # bare tuple implies basic auth
            auth=(settings.ENKETO_API_KEY, ''),
            data=data,
            timeout=settings.ENKETO_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException:
        logging.error('Failed to retrieve links from Enketo', exc_info=True)
        return {}

    try:
        links = response.json()
    except ValueError:
        logging.error('Received invalid JSON from Enketo', exc_info=True)
        return {}

    # Enketo builds its links from the host it was called on
    return {
        key: (
            settings.ENKETO_URL + value[len(settings.ENKETO_INTERNAL_URL) :]  # noqa
            if isinstance(value, str) and value.startswith(settings.ENKETO_INTERNAL_URL)
            else value
        )
        for key, value in links.items()
    }


# separated out for easier mocking/testing
def generate_enketo_links(enketo_id: str, encoded_enketo_id: str) -> dict:
    """
    Generate links using Enketo's format
    """

    result = {}
    for key, value in ENKETO_URL_FORMATS.items():
        value = value.replace('#enketo_id#', enketo_id).replace(
            '#encoded_enketo_id#', encoded_enketo_id
        )
        stripped = settings.ENKETO_URL.rstrip('/')
        value = f'{stripped}/{value}'
        result[key] = value
    return result


def to_internal_or_external_url(url: str, openrosa: bool = True) -> str:
    """
    Return the internal or external version of a url, depending on whether
    config.ENKETO_USE_INTERNAL_OPENROSA_URL is set
    """

    use_internal = config.ENKETO_USE_INTERNAL_OPENROSA_URL
    if use_internal and openrosa:
        desired_url = settings.KOBOCAT_INTERNAL_URL
    elif use_internal and not openrosa:
        desired_url = settings.KOBOFORM_INTERNAL_URL
    elif not use_internal and openrosa:
        desired_url = settings.KOBOCAT_URL
    else:
        desired_url = settings.KOBOFORM_URL
    parsed_url = urlparse(desired_url)

    return (
        urlparse(url)
        ._replace(scheme=parsed_url.scheme, netloc=parsed_url.netloc)
        .geturl()
    )
