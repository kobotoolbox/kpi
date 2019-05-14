# coding: utf-8

from rest_framework import permissions

class InAppMessagePermissions(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated():
            # Deny access to anonymous users
            return False
        if request.user.is_superuser:
            # Allow superusers to do anything
            return True
        if request.method in permissions.SAFE_METHODS:
            # Allow read-only access to any authenticated user
            return True
        elif request.method == 'PATCH':
            if not request.data:
                # A `PATCH` with no data is a check to see what's allowed, or
                # that's what the DRF "Browsable API" does, at least. We'll
                # wave it through for authenticated users
                return True
            elif request.data.keys() == ['interactions']:
                # Allow any authenticated user to update their own interactions
                return True

        # Sorry, buddy.
        return False
