from rest_framework.exceptions import NotFound, ValidationError
from allauth.headless.mfa.inputs import ActivateTOTPInput
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from allauth.mfa.totp.internal.auth import TOTP
from allauth.mfa import signals
from allauth.mfa.recovery_codes.internal.flows import auto_generate_recovery_codes
from allauth.mfa.base.internal.flows import delete_and_cleanup
from allauth.mfa.models import Authenticator

from .models import MfaMethodsWrapper


def activate_totp(request, name):
    try:
        mfa = MfaMethodsWrapper.objects.get(
            user=request.user,
            name=name,
            is_active=False,
        )
    except MfaMethodsWrapper.DoesNotExist:
        raise NotFound

    form = ActivateTOTPInput(request.data, user=request.user)
    if not form.is_valid():
        raise ValidationError(detail=form.errors)

    totp = TOTP.activate(request.user, form.secret).instance
    signals.authenticator_added.send(
        sender=Authenticator,
        request=request,
        user=request.user,
        authenticator=totp,
    )
    recovery_codes = auto_generate_recovery_codes(request)
    mfa.totp = totp
    mfa.recovery_codes = recovery_codes
    mfa.is_active = True
    mfa.save()

    return totp.wrap(), recovery_codes.wrap()


def regenerate_codes(request, name):
    try:
        mfa = MfaMethodsWrapper.objects.get(
            user=request.user,
            name=name,
            is_active=True,
        )
    except MfaMethodsWrapper.DoesNotExist:
        raise NotFound
    mfa.recovery_codes.delete()
    mfa.recovery_codes = RecoveryCodes.activate(request.user).instance
    mfa.save()

    return mfa.recovery_codes.wrap()


def deactivate_totp(request, name):
    try:
        mfa = MfaMethodsWrapper.objects.get(
            user=request.user,
            name=name,
            is_active=True,
        )
    except MfaMethodsWrapper.DoesNotExist:
        raise NotFound
    mfa.is_active = False
    mfa.save()
    delete_and_cleanup(request, mfa.totp)
