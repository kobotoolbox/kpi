from allauth.mfa.adapter import get_adapter
import pyotp
from ..models import MfaMethodsWrapper


def get_mfa_code_for_user(user):
    mfa_method = MfaMethodsWrapper.objects.get(user=user, name='app')
    adapter = get_adapter()
    secret = adapter.decrypt(mfa_method.secret)
    totp = pyotp.TOTP(secret)
    code = totp.now()
    return code
