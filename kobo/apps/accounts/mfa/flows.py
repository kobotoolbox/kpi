from allauth.headless.mfa.inputs import ActivateTOTPInput
from allauth.mfa import signals
from allauth.mfa.models import Authenticator
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from allauth.mfa.recovery_codes.internal.flows import auto_generate_recovery_codes
from allauth.mfa.totp.internal.auth import TOTP
from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from .utils import MFA_METHOD_NAME, deactivate_mfa, user_has_active_mfa


def _validate_method(name):
    if name != MFA_METHOD_NAME:
        raise NotFound


def activate_totp(request, name):
    _validate_method(name)
    with transaction.atomic():
        if user_has_active_mfa(request.user):
            raise NotFound

        # Validates the code against the secret that the activation endpoint
        # stored in the session
        form = ActivateTOTPInput(request.data, user=request.user)
        if not form.is_valid():
            raise ValidationError(detail=form.errors)

        # Clean up any orphaned recovery codes
        Authenticator.objects.filter(
            user=request.user, type=Authenticator.Type.RECOVERY_CODES
        ).delete()

        totp = TOTP.activate(request.user, form.secret).instance
        signals.authenticator_added.send(
            sender=Authenticator,
            request=request,
            user=request.user,
            authenticator=totp,
        )
        recovery_codes = auto_generate_recovery_codes(request)

    return totp.wrap(), recovery_codes.wrap()


def regenerate_codes(request, name):
    _validate_method(name)
    if not user_has_active_mfa(request.user):
        raise NotFound

    with transaction.atomic():
        Authenticator.objects.filter(
            user=request.user, type=Authenticator.Type.RECOVERY_CODES
        ).delete()
        recovery_codes = RecoveryCodes.activate(request.user).instance

    return recovery_codes.wrap()


def deactivate_totp(request, name):
    _validate_method(name)
    if not user_has_active_mfa(request.user):
        raise NotFound
    deactivate_mfa(request.user, request=request)
