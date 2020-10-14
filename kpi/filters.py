# coding: utf-8
import re
from distutils.util import strtobool

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import FieldError
from rest_framework import filters

from kpi.utils.query_parser import parse, ParseError
from .models import Asset, ObjectPermission
from .models.object_permission import (
    get_objects_for_user,
    get_anonymous_user,
    get_models_with_object_permissions,
)


class AssetOwnerFilterBackend(filters.BaseFilterBackend):
    """
    For use with nested models of Asset.
    Restricts access to items that are owned by the current user
    """

    def filter_queryset(self, request, queryset, view):
        fields = {"asset__owner": request.user}
        return queryset.filter(**fields)


class KpiObjectPermissionsFilter:
    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):

        user = request.user
        if user.is_superuser and view.action != 'list':
            # For a list, we won't deluge the superuser with everyone else's
            # stuff. This isn't a list, though, so return it all
            return queryset
        # Governs whether unsubscribed (but publicly discoverable) objects are
        # included. Exclude them by default
        all_public = bool(strtobool(
            request.query_params.get('all_public', 'false').lower()))

        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': model_cls._meta.model_name,
        }
        permission = self.perm_format % kwargs

        if user.is_anonymous:
            user = get_anonymous_user()
            # Avoid giving anonymous users special treatment when viewing
            # public objects
            owned_and_explicitly_shared = queryset.none()
        else:
            owned_and_explicitly_shared = get_objects_for_user(
                user, permission, queryset)

        if view.action != 'list':
            # Not a list, so discoverability doesn't matter
            public = get_objects_for_user(
                get_anonymous_user(), permission, queryset
            )
            return (owned_and_explicitly_shared | public).distinct()

        if all_public:
            # We were asked to return all discoverable objects. It's best to
            # minimize the queryset before passing it to
            # `get_objects_for_user()`, since that function executes a large
            # `__in` query. Find potentially discoverable objects before
            # verifying that the anonymous user can actually access them
            try:
                discoverable = queryset.filter(discoverable_when_public=True)
            except FieldError:
                try:
                    # The model does not have a discoverability setting, but
                    # maybe its parent does
                    discoverable = queryset.filter(
                        parent__discoverable_when_public=True
                    )
                except FieldError:
                    # Neither the model or its parent has a discoverability
                    # setting
                    discoverable = queryset.none()
            # Now, make sure these discoverables are actually public!
            discoverable_and_public = get_objects_for_user(
                get_anonymous_user(), permission, discoverable
            )
            return (
                owned_and_explicitly_shared | discoverable_and_public
            ).distinct()

        # `all_public` was not requested; return only objects to which the user
        # has subscribed
        try:
            subscribed = queryset.filter(usercollectionsubscription__user=user)
        except FieldError:
            try:
                # The model does not have a subscription relation, but maybe
                # its parent does
                subscribed = queryset.filter(
                    parent__usercollectionsubscription__user=user
                )
            except FieldError:
                # Neither the model or its parent has a subscription relation
                subscribed = queryset.none()
        # Make sure the subscribed objects are still public
        subscribed_and_public = get_objects_for_user(
            get_anonymous_user(), permission, subscribed
        )
        return (owned_and_explicitly_shared | subscribed_and_public).distinct()


class RelatedAssetPermissionsFilter(KpiObjectPermissionsFilter):
    """
    Uses KpiObjectPermissionsFilter to determine which assets the user
    may access, and then filters the provided queryset to include only objects
    related to those assets. The queryset's model must be related to `Asset`
    via a field named `asset`.
    """

    def filter_queryset(self, request, queryset, view):
        available_assets = super().filter_queryset(
            request=request,
            queryset=Asset.objects.all(),
            view=view
        )
        return queryset.filter(asset__in=available_assets)


class SearchFilter(filters.BaseFilterBackend):
    """
    If the request includes a `q` parameter specifying a Boolean search string
    with a Whoosh-like syntax, filter the queryset accordingly using the ORM.
    If no `q` is present, return the queryset untouched. If `q` is not
    parseable, references a field that does not exist, or specifies an invalid
    value for a field (e.g. text for an integer field), return an empty
    queryset to make the problem obvious.
    """

    def filter_queryset(self, request, queryset, view):
        try:
            q = request.query_params['q']
        except KeyError:
            return queryset

        try:
            q_obj = parse(q)
        except ParseError:
            return queryset.model.objects.none()

        try:
            return queryset.filter(q_obj)
        except (FieldError, ValueError):
            return queryset.model.objects.none()


class KpiAssignedObjectPermissionsFilter(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        # TODO: omit objects for which the user has only a deny permission
        user = request.user
        if isinstance(request.user, AnonymousUser):
            user = get_anonymous_user()
        if user.is_superuser:
            # Superuser sees all
            return queryset
        if user.pk == settings.ANONYMOUS_USER_ID:
            # Hide permissions from anonymous users
            return queryset.none()
        """
        A regular user sees permissions for objects to which they have access.
        For example, if Alana has view access to an object owned by Richard,
        she should see all permissions for that object, including those
        assigned to other users.
        """
        possible_content_types = ContentType.objects.get_for_models(
            *get_models_with_object_permissions()
        ).values()
        result = queryset.none()
        for content_type in possible_content_types:
            # Find all the permissions assigned to the user
            permissions_assigned_to_user = ObjectPermission.objects.filter(
                content_type=content_type,
                user=user,
            )
            # Find all the objects associated with those permissions, and then
            # find all the permissions applied to all of those objects
            result |= ObjectPermission.objects.filter(
                content_type=content_type,
                object_id__in=permissions_assigned_to_user.values(
                    'object_id'
                ).distinct()
            )
        return result
