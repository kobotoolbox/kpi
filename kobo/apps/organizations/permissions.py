from rest_framework import permissions


class IsOrgAdminOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow admin members of an object to edit it.
    Assumes the model instance has an `is_admin` attribute.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Instance must have an attribute named `is_org_admin`.
        return obj.is_org_admin(request.user)
