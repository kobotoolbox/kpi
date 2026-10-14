from urllib.parse import urlparse

import requests
from constance import config
from django.conf import settings

from kpi.constants import ENKETO_URL_FORMATS
from kpi.utils.log import logging


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


def to_internal_or_external_url(url: str, openrosa: bool = True) -> str:
    """
    Return `url` with its scheme and host swapped for `KOBOCAT_INTERNAL_URL`
    (`openrosa=True`) or `KOBOFORM_INTERNAL_URL` (`openrosa=False`) when
    `ENKETO_USE_INTERNAL_OPENROSA_URL` is enabled, `url` unchanged otherwise
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
