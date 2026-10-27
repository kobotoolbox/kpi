import pyotp
from allauth.mfa.adapter import get_adapter
from allauth.mfa.totp.internal.auth import SECRET_SESSION_KEY
from django.test import TestCase
from django.urls import reverse

from ..utils import get_totp_authenticator


def get_mfa_code_for_user(user):
    """
    Return a valid TOTP code for a user whose MFA is already active
    """
    totp = get_totp_authenticator(user)
    secret = get_adapter().decrypt(totp.data['secret'])
    return pyotp.TOTP(secret).now()


def get_pending_mfa_code(client):
    """
    Return a valid TOTP code for the secret that the activation endpoint stored
    in `client`'s session, before it is confirmed
    """
    secret = client.session[SECRET_SESSION_KEY]
    return pyotp.TOTP(secret).now()


def activate_mfa_for_user(client, user):
    client.force_login(user)
    client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
    code = get_pending_mfa_code(client)
    # Run the on-commit profile sync, which `TestCase` would otherwise skip
    with TestCase.captureOnCommitCallbacks(execute=True):
        client.post(
            reverse('mfa-confirm', kwargs={'method': 'app'}),
            data={'code': str(code)},
        )
    client.logout()
