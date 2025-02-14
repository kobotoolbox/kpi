from django.http import Http404
from rest_framework import permissions
from rest_framework.permissions import IsAuthenticated

from kobo.apps.organizations.constants import (
    ORG_EXTERNAL_ROLE,
    ORG_OWNER_ROLE,
    ORG_ADMIN_ROLE
)
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

    def has_object_permission(self, request, view, obj):
        if super().has_object_permission(request, view, obj):
            return True
        return request.method in permissions.SAFE_METHODS


class OrganizationNestedHasOrgRolePermission(HasOrgRolePermission):
    def has_permission(self, request, view):

        if not super().has_permission(request, view):
            return False

        try:
            organization = Organization.objects.get(
                id=view.kwargs.get('organization_id')
            )
        except Organization.DoesNotExist:
            raise Http404

        return super().has_object_permission(request, view, organization)

    def has_object_permission(self, request, view, obj):
        """
        The object check is always performed on the parent (organization) and
        is validated in `has_permission()`. Therefore, this method always returns True.
        """
        return True


class OrgMembershipInvitePermission(
    ValidationPasswordPermissionMixin, IsAuthenticated
):

    ALLOWED_ROLES = (ORG_OWNER_ROLE, ORG_ADMIN_ROLE,)

    def has_permission(self, request, view):

        self.validate_password(request)
        if not super().has_permission(request=request, view=view):
            return False

        organization_id = view.kwargs.get('organization_id')
        try:
            organization = Organization.objects.get(id=organization_id)
        except Organization.DoesNotExist:
            raise Http404

        # Fetch and attach the user role to the view for reuse in the viewset
        user = get_database_user(request.user)
        user_role = organization.get_user_role(user)
        view.user_role = user_role

        return True

    def has_object_permission(self, request, view, obj):
        org_invite = obj
        user = get_database_user(request.user)

        if view.user_role in self.ALLOWED_ROLES:
            return True

        if org_invite.invitee_identifier:
            if org_invite.invitee_identifier != user.email:
                raise Http404
        elif org_invite.invitee_id != user.pk:
            if view.user_role == ORG_EXTERNAL_ROLE:
                raise Http404
            else:
                return False

        return True


class OrgMembershipCreateOrDeleteInvitePermission(OrgMembershipInvitePermission):

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        user_role = view.user_role
        if user_role in self.ALLOWED_ROLES:
            return True
        elif user_role == ORG_EXTERNAL_ROLE:
            raise Http404

        return False
