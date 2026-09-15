from urllib.parse import urljoin

import constance
import requests
from ssrf_protect.ssrf_protect import SSRFProtect

from kpi.utils.strings import split_lines_to_list


def ssrf_safe_get(url: str, **kwargs) -> requests.Response:
    """
    Perform a GET request, validating every URL in the redirect chain against
    SSRF rules before it is requested.

    `requests` follows redirects transparently, so validating only the initial
    URL is trivially bypassed by a public host that redirects to an internal
    address. Redirects are therefore followed manually here, validating each
    hop before it is fetched. Redirect handling is owned by this function, so
    callers must not pass `allow_redirects`.
    """
    max_redirects = requests.models.DEFAULT_REDIRECT_LIMIT

    for _ in range(max_redirects + 1):
        validate_url_against_ssrf(url)
        response = requests.get(url, allow_redirects=False, **kwargs)
        if not response.is_redirect:
            return response

        url = urljoin(response.url, response.headers['location'])

    raise requests.TooManyRedirects(f'Exceeded {max_redirects} redirects')


def validate_url_against_ssrf(url: str) -> None:
    """
    Validate `url` against the configured SSRF allow/deny rules.

    Raises `SSRFProtectException` if the URL resolves to a disallowed address.
    """
    options: dict[str, list[str]] = {}
    if constance.config.SSRF_ALLOWED_IP_ADDRESS.strip():
        options['allowed_ip_addresses'] = split_lines_to_list(
            constance.config.SSRF_ALLOWED_IP_ADDRESS
        )

    if constance.config.SSRF_DENIED_IP_ADDRESS.strip():
        options['denied_ip_addresses'] = split_lines_to_list(
            constance.config.SSRF_DENIED_IP_ADDRESS
        )

    SSRFProtect.validate(url, options=options)
