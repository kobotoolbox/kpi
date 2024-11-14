from django.http import Http404
from rest_framework import permissions

from kobo.apps.organizations.constants import ORG_EXTERNAL_ROLE
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
        if obj.get_user_role(user) == ORG_EXTERNAL_ROLE:
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
        return obj.organization.is_admin(request.user)


class IsOrgOwnerOrAdminOrMember(permissions.BasePermission):
    def has_permission(self, request, view):
        # Ensure the user is authenticated
        if not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user_role = obj.organization.get_user_role(request.user)

        # Allow owners to view, update, and delete members
        if user_role == 'owner':
            return True

        # Allow admins to view and update, but not delete members
        if user_role == 'admin':
            return request.method in permissions.SAFE_METHODS or request.method == 'PATCH'

        # Allow members to only view other members
        if user_role == 'member':
            return request.method in permissions.SAFE_METHODS

        # Deny access to external users
        if user_role == 'external':
            raise Http404()

        return False
