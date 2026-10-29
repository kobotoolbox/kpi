import time
from unittest.mock import patch

from allauth.account.internal.flows.login import (
    clear_authentication_records,
)
from allauth.account.internal.flows.login import (
    record_authentication as allauth_record_authentication,
)
from allauth.socialaccount.providers.base import Provider
from django.contrib.auth import SESSION_KEY
from django.test import RequestFactory

from kobo.apps.kobo_auth.shortcuts import User


class MockProvider(Provider):
    id = 'mock_provider'
    uses_apps = False
    name = 'Mock Provider'


def record_authentication(client, methods=('password',), age=0, reauthenticated=True):
    """
    Stamp allauth's session authentication log for a test client

    `client.force_login()` bypasses allauth, so nothing is recorded and every
    re-authentication check fails. Tests that are not themselves about
    re-authentication should call this right after logging in.

    Records go through allauth's own `record_authentication()`, which binds
    them to the logged-in user. `age` backdates them by that many seconds, to
    simulate a stale re-authentication. `reauthenticated=False` writes login
    records instead, which never satisfy a re-authentication check.
    """
    session = client.session
    request = RequestFactory().get('/')
    request.session = session
    user = User.objects.get(pk=session[SESSION_KEY])
    # Login records carry no `reauthenticated` key at all
    extra_data = {'reauthenticated': True} if reauthenticated else {}

    clear_authentication_records(request)
    with patch('time.time', return_value=time.time() - age):
        for method in methods:
            allauth_record_authentication(request, user, method, **extra_data)
    session.save()


def clear_email_change_throttle(*users):
    """
    Drop the DRF throttle history for the email-change endpoint

    Tests share a real cache, so without this a run can inherit throttle
    counters from an earlier one whenever user PKs repeat.
    """
    from django.core.cache import cache

    for user in users:
        cache.delete(f'throttle_email_change_{user.pk}')
