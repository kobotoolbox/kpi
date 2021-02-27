# coding: utf-8
import re
from distutils.util import strtobool

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import FieldError
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.db.models.query import QuerySet
from rest_framework import filters
from rest_framework.request import Request

from kpi.constants import (
    ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS,
    ASSET_STATUS_SHARED,
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC,
    PERM_DISCOVER_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.exceptions import SearchQueryTooShortException
from kpi.models.asset import UserAssetSubscription
from kpi.utils.query_parser import parse, ParseError
from .models import Asset, ObjectPermission
from .models.object_permission import (
    get_objects_for_user,
    get_anonymous_user,
    get_perm_ids_from_code_names
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
        query_params = request.query_params
        collections_first = query_params.get('collections_first',
                                             'false').lower() == 'true'
        ordering = self.get_ordering(request, queryset, view)

        if collections_first:
            # If `collections_first` is `True`, we want the collections to be
            # displayed at the beginning. We add a temporary field to set a
            # priority to 1 for collections and all other asset types to 0.
            # The results are sorted by this priority first and then by what
            # comes next, either:
            # - `ordering` from querystring
            # - model default option
            queryset = queryset.annotate(
                ordering_priority=Case(
                    When(asset_type='collection', then=Value(1)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
            if ordering is None:
                # Make a copy, we don't want to alter Asset._meta.ordering
                ordering = Asset._meta.ordering.copy()
            ordering.insert(0, '-ordering_priority')

        if ordering:
            if 'subscribers_count' in ordering or \
                    '-subscribers_count' in ordering:
                queryset = queryset.annotate(subscribers_count=
                                             Count('userassetsubscription__user'))
            return queryset.order_by(*ordering)

        return queryset


class KpiObjectPermissionsFilter:

    def filter_queryset(self, request, queryset, view):

        user = request.user
        if user.is_superuser and view.action != 'list':
            # For a list, we won't deluge the superuser with everyone else's
            # stuff. This isn't a list, though, so return it all
            return queryset

        queryset = self._get_queryset_for_collection_statuses(request, queryset)
        if self._return_queryset:
            return queryset.distinct()

        # Getting the children of discoverable public collections
        queryset = self._get_queryset_for_discoverable_child_assets(
            request, queryset
        )
        if self._return_queryset:
            return queryset.distinct()

        owned_and_explicit_shared = self._get_owned_and_explicitly_shared(user)

        if view.action != 'list':
            # Not a list, so discoverability doesn't matter
            assets = owned_and_explicit_shared.union(self._get_publics())
            return queryset.filter(pk__in=assets)

        subscribed = self._get_subscribed(user)

        # As other places in the code, coerce `asset_ids` as a list to force
        # the query to be processed right now. Otherwise, because queryset is
        # a lazy query, Django creates (left) joins on tables when queryset is
        # interpreted and it is way slower than running this extra query.
        asset_ids = list(
            (
                owned_and_explicit_shared
                    .union(subscribed)
                    # Since user would be subscribed to a collection and not
                    # the assets themselves, we append children of subscribed
                    # collections to the queryset in order for `?q=parent__uid`
                    # queries to return the collection's children
                    .union(queryset.filter(parent__in=subscribed).values("pk")
                )
            ).values_list("id", flat=True)
        )
        return queryset.filter(pk__in=asset_ids)

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
            status = request.query_params[STATUS_PARAMETER].strip()
        except KeyError:
            return queryset

        if status == ASSET_STATUS_PRIVATE:
            self._return_queryset = True
            return queryset.filter(owner=request.user)

        elif status == ASSET_STATUS_SHARED:
            self._return_queryset = True
            return get_objects_for_user(user, PERM_VIEW_ASSET, queryset)

        elif status == ASSET_STATUS_PUBLIC:
            self._return_queryset = True
            return queryset.filter(pk__in=self._get_subscribed(user))

        elif status == ASSET_STATUS_DISCOVERABLE:
            self._return_queryset = True
            discoverable = self._get_discoverable(queryset)
            # We were asked not to consider subscriptions; return all
            # discoverable objects
            return discoverable

        return queryset

    def _get_queryset_for_discoverable_child_assets(
        self, request: Request, queryset: QuerySet
    ) -> QuerySet:
        """
        Returns a queryset containing the children of publically discoverable
        assets based on the discoverability of the child's parent. The parent
        uid is passed in the request query string.

        args:
            request (Request)
            queryset (QuerySet)

        returns:
            QuerySet
        """

        self._return_queryset = False
        PARENT_UID_PARAMETER = 'parent__uid'

        if 'q' not in request.query_params:
            return queryset

        request_query = request.query_params['q']
        parent_uid = re.search(
            f'{PARENT_UID_PARAMETER}:([a-zA-Z0-9]*)', request_query
        )

        if parent_uid is None:
            return queryset

        parent_obj = queryset.get(uid=parent_uid.group(1))

        if not isinstance(parent_obj, Asset):
            return queryset

        if parent_obj.has_perm(get_anonymous_user(), PERM_DISCOVER_ASSET):
            self._return_queryset = True
            return queryset.filter(pk__in=self._get_publics())

        return queryset

    @staticmethod
    def _get_owned_and_explicitly_shared(user):
        view_asset_perm_id = get_perm_ids_from_code_names(PERM_VIEW_ASSET)
        if user.is_anonymous:
            # Avoid giving anonymous users special treatment when viewing
            # public objects
            perms = ObjectPermission.objects.none()
        else:
            perms = ObjectPermission.objects.filter(
                deny=False,
                user=user,
                permission_id=view_asset_perm_id)

        return perms.values('asset')

    @staticmethod
    def _get_publics():
        view_asset_perm_id = get_perm_ids_from_code_names(PERM_VIEW_ASSET)
        return ObjectPermission.objects.filter(
            deny=False,
            user=get_anonymous_user(),
            permission_id=view_asset_perm_id).values('asset')

    @classmethod
    def _get_subscribed(cls, user):
        # Of the public objects, determine to which the user has subscribed
        if user.is_anonymous:
            user = get_anonymous_user()

        return UserAssetSubscription.objects.filter(asset__in=cls._get_publics(),
                                                    user=user).values('asset')


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
            q_obj = parse(
                q, default_field_lookups=view.search_default_field_lookups
            )
        except ParseError:
            return queryset.model.objects.none()
        except SearchQueryTooShortException as e:
            # raising an exception if the default search query without a
            # specified field is less than a set length of characters -
            # currently 3
            raise e

        try:
            # If no search field is specified, the search term is compared
            # to several default fields and therefore may return a copies
            # of the same match, therefore the `distinct()` method is required
            return queryset.filter(q_obj).distinct()
        except (FieldError, ValueError):
            return queryset.model.objects.none()


class KpiAssignedObjectPermissionsFilter(filters.BaseFilterBackend):
    """
    Used by kpi.views.v1.object_permission.ObjectPermissionViewSet only
    """

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
        A regular user sees their own permissions and the owner's permissions
        for objects to which they have access. For example, if Alana and John
        have view access to an object owned by Richard, John should see all of
        his own permissions and Richard's permissions, but not any of Alana's
        permissions.
        """
        result = ObjectPermission.objects.filter(
            Q(asset__owner=user)  # owner sees everything
            | Q(user=user)  # everyone with access sees their own
            | Q(
                # everyone with access sees the owner's
                asset__permissions__user=user, user=F('asset__owner')
            )
        ).distinct()
        return result
