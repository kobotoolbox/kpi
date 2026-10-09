from urllib.parse import urlparse

import requests
from constance import config
from django.conf import settings

from kpi.utils.log import logging


# separated out for easier mocking/testing
def create_enketo_links(data: dict) -> dict:
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
            settings.ENKETO_URL + value[len(settings.ENKETO_INTERNAL_URL):]
            if isinstance(value, str) and value.startswith(settings.ENKETO_INTERNAL_URL)
            else value
        )
        for key, value in links.items()
    }


def to_internal_url(url: str, openrosa: bool = True) -> str:
    """
    Return `url` with its scheme and host swapped for `KOBOCAT_INTERNAL_URL`
    (`openrosa=True`) or `KOBOFORM_INTERNAL_URL` (`openrosa=False`) when
    `ENKETO_USE_INTERNAL_OPENROSA_URL` is enabled, `url` unchanged otherwise
    """

    if not config.ENKETO_USE_INTERNAL_OPENROSA_URL:
        return url

    internal_url = urlparse(
        settings.KOBOCAT_INTERNAL_URL if openrosa else settings.KOBOFORM_INTERNAL_URL
    )

    return (
        urlparse(url)
        ._replace(scheme=internal_url.scheme, netloc=internal_url.netloc)
        .geturl()
    )
