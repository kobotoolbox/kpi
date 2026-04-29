# coding: utf-8
from constance import config
from rest_framework.permissions import BasePermission


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        return config.MFA_ENABLED


class EnforceSuperuserMFA(BasePermission):
    message = (
        'Superusers cannot deactivate MFA while '
        'SUPERUSER_AUTH_ENFORCEMENT is active.'
    )

    def has_permission(self, request, view):
        if (
            getattr(request.user, 'is_superuser', False)
            and getattr(config, 'SUPERUSER_AUTH_ENFORCEMENT', False)  # noqa: W503
        ):
            return False
        return True
