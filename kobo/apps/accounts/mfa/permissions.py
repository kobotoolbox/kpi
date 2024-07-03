# coding: utf-8
from constance import config
from django.conf import settings
from rest_framework.permissions import BasePermission

from kobo.apps.accounts.utils import user_has_paid_subscription
from kpi.utils.object_permission import get_database_user
from .models import MfaAvailableToUser


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        user_with_subscription = (
            settings.STRIPE_ENABLED
            and user_has_paid_subscription(
                get_database_user(request.user).username
            )
        )
        mfa_allowed = (
            not MfaAvailableToUser.objects.all().exists()
            or MfaAvailableToUser.objects.filter(
                user=get_database_user(request.user)
            ).exists()
        )

        return config.MFA_ENABLED and (user_with_subscription or mfa_allowed)
