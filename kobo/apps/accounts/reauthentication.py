import time

from allauth.account import app_settings
from allauth.account.authentication import get_authentication_records
from allauth.account.internal.flows.reauthentication import (
    get_reauthentication_flows,
)
from allauth.mfa.utils import is_mfa_enabled
from django.utils.translation import gettext as t
from rest_framework import status
from rest_framework.response import Response

# Values recorded by allauth in the session under `account_authentication_methods`;
# see `allauth.account.internal.flows.login.record_authentication()`
PASSWORD_METHOD = 'password'
MFA_METHOD = 'mfa'

REAUTHENTICATION_REQUIRED_CODE = 'reauthentication_required'


def get_required_reauthentication_methods(user) -> set[str]:
    """
    Return the authentication methods `user` must have completed recently in
    order to perform a sensitive action

    An empty set means the user cannot re-authenticate at all (e.g. an
    SSO-only account with no usable password and no MFA).
    """
    required = set()
    if user.has_usable_password():
        required.add(PASSWORD_METHOD)
    if is_mfa_enabled(user):
        required.add(MFA_METHOD)
    return required


def did_recently_reauthenticate(request) -> bool:
    """
    Stricter variant of allauth's `did_recently_authenticate()`

    allauth only checks the timestamp of the most recent authentication
    record, whichever method it used, so a password-only step satisfies it even
    for an account with MFA active. We require re-authenticating "with password,
    and also with 2FA if it's enabled", so every method the user has available
    must have been completed within `ACCOUNT_REAUTHENTICATION_TIMEOUT`.
    """
    user = request.user
    if not user.is_authenticated:
        return False

    required = get_required_reauthentication_methods(user)
    if not required:
        return True

    cutoff = time.time() - app_settings.REAUTHENTICATION_TIMEOUT
    fresh_methods = {
        record['method']
        for record in get_authentication_records(request)
        if record.get('at', 0) > cutoff
    }
    return required.issubset(fresh_methods)


def reauthentication_required_response(request) -> Response:
    """
    Tell the client which re-authentication steps it must walk the user
    through before retrying the request
    """
    return Response(
        {
            'detail': t('Re-authentication is required for this action.'),
            'code': REAUTHENTICATION_REQUIRED_CODE,
            'flows': get_reauthentication_flows(request.user),
        },
        status=status.HTTP_403_FORBIDDEN,
    )
