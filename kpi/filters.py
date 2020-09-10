# coding: utf-8
import re
from distutils.util import strtobool

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
from kpi.models.asset import UserAssetSubscription
from kpi.utils.query_parser import parse, ParseError
from .models import Asset, ObjectPermission
from .models.asset import ASSET_TYPE_COLLECTION
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

        queryset = self._get_queryset_for_collection_statuses(request, queryset)
        if self._return_queryset:
            return queryset.distinct()

        owned_and_explicitly_shared = self._get_owned_and_explicitly_shared(
            queryset, user)

        if view.action != 'list':
            public = self._get_public(queryset)
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

    def _get_queryset_for_collection_statuses(self, request, queryset):
        """
        Narrow down the queryset based on `status` parameter.
        It is useful when fetching Assets of type `collection`

        If `status` is not detected in `q`, it returns the queryset as is.
        Otherwise, there are 4 scenarios:
        - `status` == 'private': collections owned by user
        - `status` == 'shared': collections user can view
        - `status` == 'public': collections user has subscribed to (ONLY)
        - `status` == 'public-discoverable': all public collections

        Args:
            request
            queryset
        Returns:
            QuerySet
        """

        # Governs whether returned queryset should be processed immediately
        # and should stop other filtering on `queryset` in parent method of
        # `_get_queryset_for_collection_statuses()`
        self._return_queryset = False
        user = request.user
        STATUS_PARAMETER = 'status'

        try:
            q = request.query_params['q'].strip()
            if q == '':
                return queryset
        except KeyError:
            return queryset

        query_parts = q.split(' AND ')  # Can be risky if one of values contains ` AND `

        def _get_value(str_, key):
            return str_[len(key) + 1:]  # get everything after `<key>:`

        # Create filters to narrow down `queryset`
        query_parts_iter = list(query_parts)
        for query_part in query_parts_iter:
            query_part = query_part.strip()

            # Search for status
            if not query_part.startswith(f'{STATUS_PARAMETER}:'):
                continue

            value = _get_value(query_part, STATUS_PARAMETER)
            if value == ASSET_STATUS_PRIVATE:
                self._return_queryset = True
                return queryset.filter(owner_id=request.user.id)

            elif value == ASSET_STATUS_SHARED:
                self._return_queryset = True
                return get_objects_for_user(
                    user, self._permission, queryset)

            elif value == ASSET_STATUS_PUBLIC:
                self._return_queryset = True
                # ToDo Review for optimization
                public = self._get_public(queryset)
                subscribed = self._get_subscribed(public, user)
                return subscribed

            elif value == ASSET_STATUS_DISCOVERABLE:
                self._return_queryset = True
                # ToDo Review for optimization
                discoverable = self._get_discoverable(
                    self._get_public(queryset))
                # We were asked not to consider subscriptions; return all
                # discoverable objects
                return discoverable

        return queryset

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
            asset_ids = list(UserAssetSubscription.objects.
                             values_list('asset_id', flat=True).
                             filter(user_id=user.pk))
            subscribed = queryset.filter(asset_type=ASSET_TYPE_COLLECTION,
                                         id__in=asset_ids)
        except FieldError:
            # TODO, IMHO this part could be removed since Collection
            # model has been merged in Asset
            try:
                # The model does not have a subscription relation, but maybe
                # its parent does
                subscribed = queryset.filter(
                    parent__userassetsubscription__user=user
                )
            except FieldError:
                # Neither the model or its parent has a subscription relation
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
