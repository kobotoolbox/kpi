from django.http import Http404
from rest_framework import permissions

from kobo.apps.organizations.constants import EXTERNAL_ORG_ROLE
from kpi.mixins.validation_password_permission import ValidationPasswordPermissionMixin
from kpi.utils.object_permission import get_database_user


class IsOrgAdmin(
    ValidationPasswordPermissionMixin, permissions.BasePermission
):
    """
    Object-level permission to only allow admin members of an object to access it.
    Assumes the model instance has an `is_admin` attribute.
    """
    def has_permission(self, request, view):
        self.validate_password(request)
        return super().has_permission(request=request, view=view)

    def has_object_permission(self, request, view, obj):
        user = get_database_user(request.user)
        if obj.get_user_role(user) == EXTERNAL_ORG_ROLE:
            # Do not expose organization existence
            raise Http404()

        # Instance must have an attribute named `is_admin`.
        return obj.is_admin(user)


class IsOrgAdminOrReadOnly(IsOrgAdmin):
    """
    Object-level permission to only allow admin members of an object to edit it.
    Assumes the model instance has an `is_admin` attribute.
    """

    def has_object_permission(self, request, view, obj):

        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Instance must have an attribute named `is_admin`
        return obj.is_admin(request.user)
