from django.http import Http404
from rest_framework import permissions
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.constants import ORG_EXTERNAL_ROLE
from kobo.apps.organizations.models import Organization
from kpi.mixins.validation_password_permission import ValidationPasswordPermissionMixin
from kpi.utils.object_permission import get_database_user


class IsOrgAdminPermission(ValidationPasswordPermissionMixin, IsAuthenticated):
    """
    Object-level permission to only allow admin (and owner) members of an object
    to access it.
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


class HasOrgRolePermission(IsOrgAdminPermission):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        organization = Organization.objects.filter(
            id=view.kwargs.get('organization_id')
        ).first()
        if organization and not self.has_object_permission(
            request, view, organization
        ):
            return False
        return True

    def has_object_permission(self, request, view, obj):
        obj = obj if isinstance(obj, Organization) else obj.organization
        if super().has_object_permission(request, view, obj):
            return True
        return request.method in permissions.SAFE_METHODS
