# coding: utf-8
from rest_framework import exceptions, permissions


class InAppMessagePermissions(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
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
            elif list(request.data) == ['interactions']:
                # Allow any authenticated user to update their own interactions
                return True
            else:
                formatted_fields = ', '.join(
                    [f'`{x}`' for x in request.data.keys()]
                )
                raise exceptions.PermissionDenied(
                    detail=(
                        'You may update only `interactions`, but your request '
                        f'contained {formatted_fields}.'
                    )
                )

        # Sorry, buddy.
        return False
