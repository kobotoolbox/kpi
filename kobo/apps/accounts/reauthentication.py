import time

from allauth.account import app_settings
from allauth.account.authentication import get_authentication_records
from allauth.account.internal.flows.reauthentication import (
    get_reauthentication_flows,
)
from allauth.mfa.utils import is_mfa_enabled
from django.utils.translation import gettext as t
from rest_framework import serializers, status
from rest_framework.authentication import (
    SessionAuthentication as DRFSessionAuthentication,
)
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


def is_session_authenticated(request) -> bool:
    """
    Whether the request was authenticated by a browser session, as opposed to
    a stateless credential (token, Basic, OAuth2)
    """
    return isinstance(request.successful_authenticator, DRFSessionAuthentication)


def reauthentication_required(request) -> bool:
    """
    Check whether the request must be refused until the user re-authenticates

    This check applies only to session-authenticated requests. Stateless
    credentials cannot satisfy the recent reauthentication requirement.
    """
    return is_session_authenticated(request) and not did_recently_reauthenticate(
        request
    )


def validate_stateless_reauthentication(request) -> None:
    """
    Re-authenticate a request carrying a stateless credential (token, Basic,
    OAuth2), which has no session for allauth to record a re-authentication in

    The proof travels in the request body instead: the current password, plus a
    2FA code when the account has MFA enabled. This mirrors what a browser
    session is asked for, and follows the convention already used to change a
    password.

    Raises `ValidationError` when the proof is missing or wrong; returns
    silently when the account has nothing to prove (an SSO-only account with no
    usable password and no MFA), matching the session path.
    """
    user = request.user
    errors = {}

    if user.has_usable_password():
        current_password = request.data.get('current_password')
        if not current_password:
            errors['current_password'] = t(
                'This field is required to change the email address when'
                ' authenticating without a browser session.'
            )
        elif not user.check_password(current_password):
            errors['current_password'] = t('Incorrect current password.')

    if is_mfa_enabled(user):
        mfa_code = request.data.get('mfa_code')
        if not mfa_code:
            errors['mfa_code'] = t(
                'This field is required to change the email address when'
                ' authenticating without a browser session and MFA is enabled.'
            )
        elif not errors:
            # Only spend the 2FA code once the password has passed; a wrong
            # password must not cost the user a recovery code
            if not _is_valid_mfa_code(user, mfa_code):
                errors['mfa_code'] = t('Invalid code.')

    if errors:
        raise serializers.ValidationError(errors)


def _is_valid_mfa_code(user, code) -> bool:
    """
    Validate a TOTP or recovery code, reusing the serializer that already backs
    the MFA endpoints so that legacy migrated recovery codes keep working
    """
    from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
    from kobo.apps.accounts.mfa.serializers import MfaCodeSerializer

    method = (
        MfaMethodsWrapper.objects.filter(user=user, is_active=True)
        .values_list('name', flat=True)
        .first()
    )
    if method is None:
        return False

    serializer = MfaCodeSerializer(
        data={'code': code}, context={'user': user, 'method': method}
    )
    return serializer.is_valid()


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
