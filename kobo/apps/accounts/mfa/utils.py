from allauth.mfa.base.internal.flows import delete_and_cleanup
from allauth.mfa.models import Authenticator
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from constance import config
from django.contrib.auth.hashers import check_password, identify_hasher
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.http import HttpRequest

from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic

# KPI supports a single MFA method, a TOTP app, exposed by the legacy endpoints
# as `/api/v2/auth/app/...`
MFA_METHOD_NAME = 'app'


def get_totp_authenticator(user) -> Authenticator | None:
    return Authenticator.objects.filter(
        user_id=user.pk, type=Authenticator.Type.TOTP
    ).first()


def user_has_active_mfa(user) -> bool:
    """
    Whether `user` has MFA turned on

    allauth's `Authenticator` is the source of truth: a TOTP authenticator
    exists while MFA is on, and allauth deletes it when MFA is turned off.
    Recovery codes alone do not count, as they only back up the TOTP app.
    """
    return Authenticator.objects.filter(
        user_id=user.pk, type=Authenticator.Type.TOTP
    ).exists()


def validate_mfa_code(user, code: str) -> Authenticator | None:
    """
    Return the authenticator that accepts `code`, or `None`

    A matching recovery code is spent. Besides allauth's own codes, accepts the
    recovery codes migrated from the former 2FA system, which are stored hashed
    and which allauth compares as plain text. Rate limiting is left to callers
    """
    authenticators = Authenticator.objects.filter(
        user_id=user.pk,
        type__in=[Authenticator.Type.TOTP, Authenticator.Type.RECOVERY_CODES],
    )
    # TOTP first: the common case, and cheap, unlike the hashed checks
    for authenticator in sorted(
        authenticators, key=lambda a: a.type != Authenticator.Type.TOTP
    ):
        wrapped = authenticator.wrap()
        if authenticator.type == Authenticator.Type.RECOVERY_CODES and (
            has_hashed_migrated_codes(wrapped)
        ):
            # Not through allauth, which would compare `code` with the stored
            # hashes themselves
            if _spend_hashed_migrated_code(wrapped, code):
                return authenticator
            continue
        if wrapped.validate_code(code):
            return authenticator
    return None


def has_hashed_migrated_codes(recovery_codes: RecoveryCodes) -> bool:
    """
    Whether `recovery_codes` holds unused codes migrated from the former 2FA
    system, which only stored their hashes
    """
    codes = recovery_codes._get_migrated_codes()
    # `None` without migrated codes, `[]` once every one of them is spent
    if not codes:
        return False
    try:
        identify_hasher(codes[0])
    except ValueError:
        # Plain-text migrated codes, which allauth handles
        return False
    return True


def _spend_hashed_migrated_code(recovery_codes: RecoveryCodes, code: str) -> bool:
    """
    Spend `code` if it matches one of the hashed migrated recovery codes
    """
    for hashed_code in recovery_codes._get_migrated_codes():
        if check_password(code, hashed_code):
            # The codes read so far may be stale: `validate_code()` locks the
            # row and refuses a code that a concurrent request has just spent
            return recovery_codes.validate_code(hashed_code)
    return False


def mfa_is_active_expression(user_ref: str = 'pk') -> Exists:
    """
    Queryset expression equivalent to `user_has_active_mfa()`, for
    annotations and filters. `user_ref` points to the user id in the outer
    query
    """
    return Exists(
        Authenticator.objects.filter(
            user_id=OuterRef(user_ref), type=Authenticator.Type.TOTP
        )
    )


def is_mfa_deactivation_blocked(user) -> bool:
    return bool(config.SUPERUSER_AUTH_ENFORCEMENT and user.is_superuser)


def deactivate_mfa(user, request: HttpRequest | None = None):
    """
    Turn MFA off for `user` by deleting their TOTP and recovery codes
    authenticators. `UserProfile.is_mfa_active` follows through the
    `Authenticator` signals
    """
    if is_mfa_deactivation_blocked(user):
        raise ValidationError(
            f'MFA deactivation is disabled for superuser "{user.username}" '
            f'while SUPERUSER_AUTH_ENFORCEMENT is active.'
        )

    with kc_transaction_atomic(), transaction.atomic():
        totp = get_totp_authenticator(user)
        if (
            totp is not None
            and request is not None
            and getattr(request, 'user', None) == user
        ):
            # Also sends allauth's `authenticator_removed` signal, which needs
            # the request user to be the owner of the authenticator
            delete_and_cleanup(request, totp)
        else:
            Authenticator.objects.filter(
                user_id=user.pk,
                type__in=[
                    Authenticator.Type.TOTP,
                    Authenticator.Type.RECOVERY_CODES,
                ],
            ).delete()


def sync_mfa_profiles() -> tuple[int, int]:
    """
    Align `UserProfile.is_mfa_active` (read by KoboCAT) with the TOTP
    authenticators. Returns how many profiles were turned on and off
    """
    # Evaluate query to a list to support cross-database subqueries
    active_mfa_user_ids = list(
        Authenticator.objects.filter(type=Authenticator.Type.TOTP).values_list(
            'user_id', flat=True
        )
    )

    with kc_transaction_atomic():
        # `exclude()`, not `filter(is_mfa_active=False)`: the column can be NULL,
        # which reads as False, and `= 0` in SQL would skip those rows
        enabled = (
            UserProfile.objects.filter(user_id__in=active_mfa_user_ids)
            .exclude(is_mfa_active=True)
            .update(is_mfa_active=True)
        )
        disabled = (
            UserProfile.objects.filter(is_mfa_active=True)
            .exclude(user_id__in=active_mfa_user_ids)
            .update(is_mfa_active=False)
        )

    return enabled, disabled
