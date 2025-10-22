from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import InsightMembership, InsightProject


class IsInsightZenAdminOrReadOnly(BasePermission):
    """Allow safe methods for project members and write operations for admins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        if request.method in SAFE_METHODS or request.method == 'POST':
            return True
        # For write operations we require project-level admin rights; view ensures.
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.is_staff:
            return True
        if request.method in SAFE_METHODS:
            return self._has_membership(request.user, obj)
        return self._has_admin_role(request.user, obj)

    def _has_membership(self, user, obj):
        if isinstance(obj, InsightProject):
            return InsightMembership.objects.filter(
                project=obj,
                user=user,
                is_active=True,
            ).exists()
        if hasattr(obj, 'project_id'):
            return InsightMembership.objects.filter(
                project_id=obj.project_id,
                user=user,
                is_active=True,
            ).exists()
        return False

    def _has_admin_role(self, user, obj):
        project_id = None
        if isinstance(obj, InsightProject):
            project_id = obj.pk
        elif hasattr(obj, 'project_id'):
            project_id = obj.project_id
        if project_id is None:
            return False
        return InsightMembership.objects.filter(
            project_id=project_id,
            user=user,
            is_active=True,
            role__in=[
                InsightMembership.ROLE_ADMIN,
                InsightMembership.ROLE_MANAGER,
            ],
        ).exists()
