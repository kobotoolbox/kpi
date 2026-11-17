# coding: utf-8
from constance import config
from rest_framework.permissions import BasePermission


class IsMfaEnabled(BasePermission):
    def has_permission(self, request, view):
        return config.MFA_ENABLED
