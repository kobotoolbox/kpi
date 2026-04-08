# coding: utf-8
from constance import config
from django.conf import settings
from rest_framework.permissions import BasePermission

from kobo.apps.accounts.utils import user_has_paid_subscription
from kpi.utils.object_permission import get_database_user
from .models import MfaAvailableToUser


def mfa_allowed_for_user(user):
    user_with_subscription = (
        settings.STRIPE_ENABLED and user_has_paid_subscription(user.username)
    )
    mfa_allowed = (
        not MfaAvailableToUser.objects.all().exists()
        or MfaAvailableToUser.objects.filter(user=user).exists()
    )

    return config.MFA_ENABLED and (user_with_subscription or mfa_allowed)


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        return mfa_allowed_for_user(
            get_database_user(request.user)
        )


class EnforceSuperuserMFA(BasePermission):
    message = 'Superusers cannot deactivate MFA while SUPERUSER_AUTH_ENFORCEMENT is active.'

    def has_permission(self, request, view):
        if getattr(request.user, 'is_superuser', False) and getattr(
            config, 'SUPERUSER_AUTH_ENFORCEMENT', False
        ):
            return False
        return True
