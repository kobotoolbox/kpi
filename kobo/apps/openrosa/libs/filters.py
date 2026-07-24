from django.conf import settings
from rest_framework.filters import BaseFilterBackend

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.permissions import (
    XFORM_MODELS_NAMES,
    get_xform_ids_for_user,
)
from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_VIEW_ASSET
from kpi.utils.object_permission import get_database_user


class ObjectPermissionsFilter(BaseFilterBackend):
    """
    Copy from django-rest-framework-guardian `ObjectPermissionsFilter`
    """

    permission = PERM_VIEW_ASSET
    shortcut_kwargs = {
        'accept_global_perms': False,
    }

    ORG_ADMIN_EXEMPT_VIEWS = {
        'XFormListApi': [
            'manifest_authenticated',
            'form_list_authenticated',
            'retrieve',
            'media',
        ]
    }

    def filter_queryset(self, request, queryset, view):
        user = request.user

        if org_admin_queryset := self._get_objects_for_org_admin(
            request, queryset, view
        ):
            return org_admin_queryset

        if queryset.model._meta.model_name in XFORM_MODELS_NAMES:
            xform_ids = get_xform_ids_for_user(user, perm=self.permission)
            return queryset.filter(id__in=xform_ids)

        raise NotImplementedError

    def _get_objects_for_org_admin(self, request, queryset, view):
        """
        Retrieves all objects belonging to the owner of an organization.

        If the current user is an admin of the organization associated with the
        owner of the given object, this method returns all related objects
        """

        # Only check for specific view and action
        if not (
            view.action in self.ORG_ADMIN_EXEMPT_VIEWS.get(view.__class__.__name__, {})
        ):
            return

        xform_id_string = request.query_params.get('formID', False)
        object_id = request.parser_context['kwargs'].get('pk', False)

        if xform_id_string or object_id:

            xform_filter = (
                {'xforms__id_string': xform_id_string}
                if xform_id_string
                else {'xforms__pk': object_id}
            )

            if (
                owner := User.objects.using(settings.OPENROSA_DB_ALIAS)
                .filter(**xform_filter)
                .first()
            ):
                user = get_database_user(request.user)
                if owner.organization.is_admin_only(user):
                    return queryset.filter(user=owner)


class AnonDjangoObjectPermissionFilter(ObjectPermissionsFilter):
    def filter_queryset(self, request, queryset, view):
        """
        Anonymous user has no object permissions, return queryset as it is.
        """
        if request.user.is_anonymous:
            return queryset

        return super().filter_queryset(request, queryset, view)


class RowLevelObjectPermissionFilter(ObjectPermissionsFilter):
    def filter_queryset(self, request, queryset, view):
        """
        Return queryset as-is if user is anonymous or super user. Otherwise,
        narrow down the queryset to what the user is allowed to see.
        """

        # Queryset cannot be narrowed down for anonymous and superusers because
        # they do not have object level permissions (actually a superuser could
        # have object level permission).
        # Thus, we return queryset immediately even if it is a larger subset and
        # some of its objects are not allowed to accessed by `request.user`.
        # We need to avoid `guardian` filter to allow:
        # - anonymous user to see public data
        # - superuser to take actions on all objects
        # However, guardian was removed as dependency, so this may change in the future
        # The permissions validation is handled by the permission classes and
        # should deny access to forbidden data.
        if request.user.is_anonymous or request.user.is_superuser:
            return queryset

        return super().filter_queryset(request, queryset, view)


class XFormListObjectPermissionFilter(RowLevelObjectPermissionFilter):
    permission = PERM_ADD_SUBMISSIONS
