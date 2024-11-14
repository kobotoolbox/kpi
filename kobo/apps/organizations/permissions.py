from rest_framework import permissions

from kpi.mixins.validation_password_permission import ValidationPasswordPermissionMixin


class IsOrgAdminOrReadOnly(
    ValidationPasswordPermissionMixin, permissions.BasePermission
):
    """
    Object-level permission to only allow admin members of an object to edit it.
    Assumes the model instance has an `is_admin` attribute.
    """

    def has_permission(self, request, view):
        self.validate_password(request)
        return super().has_permission(request=request, view=view)

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Instance must have an attribute named `owner`.
        return obj.is_admin(request.user)
