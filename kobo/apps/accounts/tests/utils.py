import time

from allauth.account.internal.flows.login import (
    AUTHENTICATION_METHODS_SESSION_KEY,
)
from allauth.socialaccount.providers.base import Provider


class MockProvider(Provider):
    id = 'mock_provider'
    uses_apps = False
    name = 'Mock Provider'


def record_authentication(client, methods=('password',), age=0):
    """
    Stamp allauth's session authentication log for a test client

    `client.force_login()` bypasses allauth, so nothing is recorded and every
    re-authentication check fails. Tests that are not themselves about
    re-authentication should call this right after logging in.

    `age` backdates the records by that many seconds, to simulate a stale
    re-authentication.
    """
    at = time.time() - age
    session = client.session
    session[AUTHENTICATION_METHODS_SESSION_KEY] = [
        {'method': method, 'at': at} for method in methods
    ]
    session.save()
