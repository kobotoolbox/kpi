import pyotp
from allauth.mfa.adapter import get_adapter
from django.urls import reverse

from ..models import MfaMethodsWrapper


def get_mfa_code_for_user(user):
    mfa_method = MfaMethodsWrapper.objects.get(user=user, name='app')
    adapter = get_adapter()
    secret = adapter.decrypt(mfa_method.secret)
    totp = pyotp.TOTP(secret)
    code = totp.now()
    return code


def activate_mfa_for_user(client, user):
    client.force_login(user)
    client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
    code = get_mfa_code_for_user(user)
    client.post(
        reverse('mfa-confirm', kwargs={'method': 'app'}), data={'code': str(code)}
    )
    client.logout()
