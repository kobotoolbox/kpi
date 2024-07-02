# coding: utf-8
from rest_framework.permissions import BasePermission

from .models import MfaAvailableToUser
from kpi.utils.object_permission import get_database_user


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        mfa_available = MfaAvailableToUser.objects.filter(
            user=get_database_user(request.user)
        ).exists()
        return mfa_available
