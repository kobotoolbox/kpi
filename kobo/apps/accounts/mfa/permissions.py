# coding: utf-8
from constance import config
from rest_framework.permissions import BasePermission

from .models import MfaAvailableToUser
from kpi.utils.object_permission import get_database_user


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        return config.MFA_ENABLED and (
            # whitelist is enabled only if the table is not empty
            not MfaAvailableToUser.objects.all().exists()
            # if it's enabled,
            or
            MfaAvailableToUser.objects.filter(
                user=get_database_user(request.user)
            ).exists()
        )
