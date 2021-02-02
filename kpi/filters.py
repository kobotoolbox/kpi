# coding: utf-8
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import FieldError
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from rest_framework import filters

from kpi.constants import (
    ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS,
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC,
    ASSET_STATUS_SHARED,
    ASSET_STATUS_SUBSCRIBED,
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


class AssetPermissionFilter:
    """
    Restricts a queryset to appropriate assets based on:
    * directly granted user permissions
    * permissions granted to the public, i.e. granted to AnonymousUser
    * discoverablility, when invoked by a list view
        * including the children of discoverable assets
    * the optional 'status' query parameter
    """
    @staticmethod
    def get_assets_granted_not_denied(**kwargs):
        # TODO: use this to rewrite get_objects_for_user()?
        if 'deny' in kwargs:
            raise RuntimeError("Cannot filter on the 'deny' field")
        grants = ObjectPermission.objects.filter(deny=False, **kwargs)
        denies = ObjectPermission.objects.filter(deny=True, **kwargs)
        effective_grants = grants.values('asset').difference(
            denies.values('asset')
        )
        # distinct() required because inherited and directly-assigned
        # permissions can exist simultaneously for the same asset; luckily,
        # it's a cheap operation this time
        return effective_grants.distinct()

    @classmethod
    def get_public_and_discoverable_pks(cls, queryset):
        view_perm_pk = get_perm_ids_from_code_names(PERM_VIEW_ASSET)
        disco_perm_pk = get_perm_ids_from_code_names(PERM_DISCOVER_ASSET)
        anon = get_anonymous_user()
        public_pks = cls.get_assets_granted_not_denied(
            user=anon, permission=view_perm_pk
        )
        disco_pks = cls.get_assets_granted_not_denied(
            user=anon, permission=disco_perm_pk
        )
        disco_pks_and_kids = public_pks.intersection(
            disco_pks.union(
                # include the children of discoverable assets
                # TODO: make discoverability inheritable?
                queryset.order_by().filter(parent__in=disco_pks).values('pk')
            )
        ).distinct()
        return public_pks, disco_pks_and_kids

    @classmethod
    def get_all_viewable_pks(cls, request, queryset, view):
        public_pks, disco_pks_and_kids = cls.get_public_and_discoverable_pks(
            queryset
        )

        view_perm_pk = get_perm_ids_from_code_names(PERM_VIEW_ASSET)
        if request.user.is_anonymous:
            # we've already handled anonymous' view assignments as "public",
            # so don't add anything here
            explicitly_viewable_pks = ObjectPermission.objects.none()
        else:
            # find assets that the requestor specifically has permission to
            # view
            explicitly_viewable_pks = cls.get_assets_granted_not_denied(
                user=request.user,
                permission=view_perm_pk,
            )

        all_viewable_pks = explicitly_viewable_pks
        if view.action == 'list':
            # this is a list, so the only public assets we may reveal are the
            # discoverable ones
            all_viewable_pks = all_viewable_pks.union(disco_pks_and_kids)
        else:
            # if we're here, the requestor already knows the identity of a
            # specific asset. discoverability doesn't matter!
            all_viewable_pks = all_viewable_pks.union(public_pks)

        return all_viewable_pks.distinct()

    @classmethod
    def filter_by_status(cls, status, user, queryset):
        """
        'status' is an optional query parameter that accepts the following
        values:
            * 'private': return only assets owned by requestor
            * 'shared': return only assets that requestor has explicit
                permission to access
            * 'subscribed': return only assets to which requestor has
                subscribed
            * 'public-discoverable': return all discoverable assets
        """
        if status == ASSET_STATUS_PRIVATE:
            return queryset.filter(owner=user)
        elif status == ASSET_STATUS_SHARED:
            return queryset.filter(
                pk__in=cls.get_assets_granted_not_denied(
                    user=user,
                    permission=get_perm_ids_from_code_names(PERM_VIEW_ASSET),
                )
            )
        elif status == ASSET_STATUS_SUBSCRIBED:
            if user.is_anonymous:
                # anonymous can't subscribe to anything
                return queryset.none()
            _, disco_pks_and_kids = cls.get_public_and_discoverable_pks(
                queryset
            )
            subscribed_pks = UserAssetSubscription.objects.filter(
                user=user
            ).values('asset')
            return queryset.filter(
                pk__in=subscribed_pks.intersection(disco_pks_and_kids)
            )
        elif status == ASSET_STATUS_DISCOVERABLE:
            _, disco_pks_and_kids = cls.get_public_and_discoverable_pks(
                queryset
            )
            return queryset.filter(pk__in=disco_pks_and_kids)
        elif status == ASSET_STATUS_PUBLIC:
            # 'public' as returned by AssetSerializer._get_status() has nothing
            # to do with subscriptions, but this class used to treat 'public'
            # the way we treat 'subscribed' now
            # FIXME: figure out the original intent
            raise NotImplementedError("Cannot query the 'public' status")

        # Invalid status filter: return no matches to make the mistake
        # obvious
        return queryset.none()

    def filter_queryset(self, request, queryset, view):
        STATUS_PARAMETER = 'status'
        try:
            status = request.query_params[STATUS_PARAMETER].strip()
        except KeyError:
            pass
        else:
            return self.filter_by_status(status, request.user, queryset)

        if request.user.is_superuser:
            # ok, boss, you get it all
            return queryset

        all_viewable_pks = self.get_all_viewable_pks(request, queryset, view)

        # TODO: *why* does wrapping this in an extra `in` query speed it up so
        # dramatically?
        # given a user (tinok4 on kf.beta) with 5450 owned assets and 70
        # non-owned but viewable assets, slicing the first 100 results off of
        # the queryset and coercing them to a list takes 3+ minutes without
        # wrapping, but only 10 seconds with wrapping. clearing the ordering
        # also alleviates the slowdown without needing to wrap, but i imagine
        # we need that default ordering
        return queryset.filter(
            pk__in=queryset.filter(pk__in=all_viewable_pks.distinct())
        )


class RelatedAssetPermissionsFilter(AssetPermissionFilter):
    """
    Uses AssetPermissionFilter to determine which assets the user
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
                q, default_field_lookups=ASSET_SEARCH_DEFAULT_FIELD_LOOKUPS
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
