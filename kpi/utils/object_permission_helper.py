# coding: utf-8
from django.conf import settings

from kpi.constants import PERM_MANAGE_ASSET, PERM_FROM_KC_ONLY


class ObjectPermissionHelper:

    @classmethod
    def get_user_permission_assignments_queryset(cls, affected_object, user):
        """
        Returns a queryset to fetch `affected_object`'s permission assignments
        that `user` is allowed to see.

        Args:
            affected_object (Asset)
            user (User)
        Returns:
            QuerySet

        """

        # `affected_object.permissions` is a `GenericRelation(ObjectPermission)`
        # Don't Prefetch `content_object`.
        # See `AssetPermissionAssignmentSerializer.to_representation()`
        queryset = affected_object.permissions.filter(deny=False).select_related(
            'permission', 'user'
        ).order_by(
            'user__username', 'permission__codename'
        ).exclude(permission__codename=PERM_FROM_KC_ONLY).all()

        # Filtering is done in `get_queryset` instead of FilteredBackend class
        # because it's specific to `ObjectPermission`.
        if not user or user.is_anonymous:
            queryset = queryset.filter(user_id=affected_object.owner_id)
        elif not affected_object.has_perm(user, PERM_MANAGE_ASSET):
            # Display only users' permissions if they are not allowed to modify
            # others' permissions
            queryset = queryset.filter(user_id__in=[user.pk,
                                                    affected_object.owner_id,
                                                    settings.ANONYMOUS_USER_ID])

        return queryset

    @classmethod
    def get_user_permission_assignments(cls, affected_object, user,
                                        object_permission_assignments):
        """
        Works like `get_user_permission_assignments_queryset` but returns
        a list instead of a queryset. It also needs a list of all
        `affected_object`'s permission assignments to search for assignments
        `user` is allowed to see.

        Args:
            affected_object (Asset)
            user (User)
            object_permission_assignments (list):
        Returns:
             list

        """
        user_permission_assignments = []
        filtered_user_ids = None

        if not user or user.is_anonymous:
            filtered_user_ids = [affected_object.owner_id]
        elif not affected_object.has_perm(user, PERM_MANAGE_ASSET):
            # Display only users' permissions if they are not allowed to modify
            # others' permissions
            filtered_user_ids = [affected_object.owner_id,
                                 user.pk,
                                 settings.ANONYMOUS_USER_ID]

        for permission_assignment in object_permission_assignments:
            if (filtered_user_ids is None or
                    permission_assignment.user_id in filtered_user_ids):
                user_permission_assignments.append(permission_assignment)

        return user_permission_assignments
