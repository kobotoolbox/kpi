# coding: utf-8
import re

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import FieldError
from django.db.models import Count, Q
from rest_framework import filters


from kpi.constants import (
    PERM_DISCOVER_ASSET,
    ASSET_STATUS_SHARED,
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC
)
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


class AssetOrderingFilter(filters.OrderingFilter):

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)

        if ordering:
            if 'subscribers_count' in ordering or \
                    '-subscribers_count' in ordering:
                queryset = queryset.annotate(subscribers_count=
                                             Count('userassetsubscription__user'))
            return queryset.order_by(*ordering)

        return queryset


class KpiObjectPermissionsFilter:

    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):
        user = request.user

        if user.is_superuser and view.action != 'list':
            # For a list, we won't deluge the superuser with everyone else's
            # stuff. This isn't a list, though, so return it all
            return queryset

        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': model_cls._meta.model_name,
        }
        self._permission = self.perm_format % kwargs

        queryset = self._get_filtered_queryset(request, queryset)
        if self._return_filtered_queryset:
            return queryset.distinct()

        owned_and_explicitly_shared = self._get_owned_and_explicitly_shared(
            queryset, user)

        public = self._get_public(queryset)

        if view.action != 'list':
            # Not a list, so discoverability doesn't matter
            return (owned_and_explicitly_shared | public).distinct()

        subscribed = self._get_subscribed(queryset, user)

        return (owned_and_explicitly_shared | subscribed).distinct()

    def _get_discoverable(self, queryset):
        # We were asked not to consider subscriptions; return all
        # discoverable objects
        return get_objects_for_user(
            get_anonymous_user(), PERM_DISCOVER_ASSET,
            queryset
        )

    def _get_filtered_queryset(self, request, queryset):
        """
        Gets edit URL of the submission from `kc` through proxy
        TODO: Review this code

        Args:
            request
            queryset
        Returns:
            QuerySet
        """

        self._return_filtered_queryset = False
        user = request.user

        try:
            q = request.query_params['q'].strip()
            if q == '':
                return queryset
        except KeyError:
            return queryset

        query_parts = q.split(' AND ')  # Can be risky if one of values contains ` AND `
        filters_ = []

        def _get_queryset():
            all_filters = Q()
            for filter_ in filters_:
                all_filters &= filter_
            return queryset.filter(all_filters)

        def _get_value(str_, key):
            return str_[len(key) + 1:]  # get everything after `<key>:`

        # Create filters to narrow down `queryset`
        query_parts_iter = list(query_parts)
        for query_part in query_parts_iter:
            query_part = query_part.strip()

            # Search for status
            if not query_part.startswith('status:'):
                continue

            self._return_filtered_queryset = True
            value = _get_value(query_part, 'status')
            if value == ASSET_STATUS_PRIVATE:
                filters_.append(Q(owner_id=request.user.id))
                query_parts.remove(query_part)

            elif value == ASSET_STATUS_SHARED:
                return get_objects_for_user(
                    user, self._permission, _get_queryset())

            elif value == ASSET_STATUS_PUBLIC:
                public = self._get_public(_get_queryset())
                subscribed = self._get_subscribed(public, user)
                return subscribed

            elif value == ASSET_STATUS_DISCOVERABLE:
                discoverable = self._get_discoverable(
                    self._get_public(_get_queryset()))
                # We were asked not to consider subscriptions; return all
                # discoverable objects
                return discoverable

        return _get_queryset()

    def _get_owned_and_explicitly_shared(self, queryset, user):
        if user.is_anonymous:
            # Avoid giving anonymous users special treatment when viewing
            # public objects
            owned_and_explicitly_shared = queryset.none()
        else:
            owned_and_explicitly_shared = get_objects_for_user(
                user, self._permission, queryset)

        return owned_and_explicitly_shared

    def _get_public(self, queryset):
        return get_objects_for_user(get_anonymous_user(),
                                    self._permission, queryset)

    def _get_subscribed(self, queryset, user):
        # Of the public objects, determine to which the user has
        # subscribed
        if user.is_anonymous:
            user = get_anonymous_user()
        try:
            subscribed = queryset.filter(userassetsubscription__user=user)
            # TODO: should this expand beyond the immediate parents to include
            # all ancestors to which the user has subscribed?
            subscribed |= queryset.filter(
                parent__userassetsubscription__user=user
            )
        except FieldError:
            # The model does not have a subscription relation
            subscribed = queryset.none()

        return subscribed


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
        # TODO Fix search with `summary__languages`
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
