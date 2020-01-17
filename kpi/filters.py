# coding: utf-8
import re

import haystack
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import FieldError
from django.db.models import Count, Q
from haystack.backends.whoosh_backend import WhooshSearchBackend
from haystack.constants import DJANGO_CT
from haystack.query import SearchQuerySet
from haystack.utils import get_model_ct
from rest_framework import filters
from whoosh.qparser import QueryParser
from whoosh.query import Term

from kpi.constants import (
    PERM_DISCOVER_ASSET,
    ASSET_STATUS_SHARED,
    ASSET_STATUS_DISCOVERABLE,
    ASSET_STATUS_PRIVATE,
    ASSET_STATUS_PUBLIC
)
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


class FilteredQuerySetMixin:
    """
    Handles `q` query string parameter.

    Main purpose is to avoid duplicate code between `SearchFilter`
    and `KpiObjectPermissionsFilter`.
    Because `q` now supports `parent__uid:none` and `status`.
    `status` is processed within `KpiObjectPermissionsFilter` and
    `parent__uid`&`asset_type` are processed within `SearchFilter
    TODO Review/refactor(/remove?) in https://github.com/kobotoolbox/kpi/issues/2514
    """

    def get_discoverable(self, queryset):
        # We were asked not to consider subscriptions; return all
        # discoverable objects
        return get_objects_for_user(
            get_anonymous_user(), PERM_DISCOVER_ASSET,
            queryset
        )

    def get_filtered_queryset(self, request, queryset, skipped_fields,
                              skip_subsequent_filtering=False):
        """
        Gets edit URL of the submission from `kc` through proxy

        Args:
            request
            queryset
            skipped_fields (dict): fields in `q` parameter to be skipped when
                filtering queryset. Supported fields are:
                - `status`
                - `asset_type`
                - `summary__languages`
                - `settings__country__value`
                - `settings__organization`
                - `settings__sector__value`
                - `parent__uid
                It is useful to avoid applying same filters on queryset when
                calling the method several times from different Filter classes.
            skip_subsequent_filtering (bool): Set value of
                `_return_filtered_queryset` when `q` parameter is empty or
                does not exist. It allows to keep filtering (or not) within
                the Filter class after the call of this method.
        Returns:
            QuerySet
        """

        self._return_filtered_queryset = False
        user = request.user

        try:
            q = request.query_params['q'].strip()
            if q == '':
                self._return_filtered_queryset = skip_subsequent_filtering
                return queryset
        except KeyError:
            self._return_filtered_queryset = skip_subsequent_filtering
            return queryset

        query_parts = q.split(' AND ')  # Can be risky if one of values contains ` AND `
        filters_ = []

        def add_filter(query_part_, keyword, real_field=None):
            if query_part_.startswith(f'{keyword}:'):
                filters_.append(get_subquery(query_part_, real_field))
                return True
            return False

        def get_queryset():
            all_filters = Q()
            for filter_ in filters_:
                all_filters &= filter_
            return queryset.filter(all_filters)

        def get_subquery(query_part_, real_field=None):
            """
            Prepares a subquery to be added to `filters_`

            e.g.:
            if `query_part_` is `asset_type:collection OR asset_type:template`
            it should return
                Q(asset_type__in=['collection', 'template'])

            but if `real_field` is specified an `OR` operator is used instead.
            it should return then:
                Q(asset_type__contains='collection') |
                Q(asset_type__contains='template')

            Useful when `IN` cannot be used. For example: `languages`
            which is part of `summary` field which is not a JSONBField.

            :param query_part_: splitted part of querystring
            :param real_field: real field name of the model
            :return: Q()
            """
            field_ = query_part_[:query_part_.index(':')]
            # Retrieve from `query_part_`
            # e.g: `query_part_` = `asset_type:collection OR asset_type:template`
            # `values` should be ['collection', 'template']
            values = get_value(query_part_, field_). \
                replace(f'{field_}:', ''). \
                split(' OR ')

            subquery = Q()
            if real_field is None:
                subquery = Q(**{f'{field_}__in': [value_.strip()
                                                  for value_ in values]})
            else:
                for value_ in values:
                    subquery |= Q(**{f'{real_field}__contains': value_.strip()})

                subquery = Q(subquery)

            return subquery

        def get_value(str_, key):
            return str_[len(key) + 1:]  # get everything after `<key>:`

        # Remove skipped fields from filters builds
        query_parts_iter = list(query_parts)
        for query_part in query_parts_iter:
            query_part = query_part.strip()
            try:
                field = query_part[:query_part.index(':')]
                if skipped_fields.get(field) is True:
                    query_parts.remove(query_part)
            except ValueError:
                pass

        # Create filters to narrow down `queryset`
        query_parts_iter = list(query_parts)
        for query_part in query_parts_iter:
            query_part = query_part.strip()

            # Search for asset_type
            if add_filter(query_part, 'asset_type'):
                query_parts.remove(query_part)
                continue

            if add_filter(query_part, 'summary__languages', 'summary'):
                query_parts.remove(query_part)
                continue

            if add_filter(query_part, 'settings__country__value'):
                query_parts.remove(query_part)
                continue

            if add_filter(query_part, 'settings__organization'):
                query_parts.remove(query_part)
                continue

            if add_filter(query_part, 'settings__sector__value'):
                query_parts.remove(query_part)
                continue

            # Search for parent
            if query_part.startswith('parent__uid:'):
                value = get_value(query_part, 'parent__uid').lower()
                null_values = ['none', 'null', '']
                if any(x == value for x in null_values):
                    filters_.append(Q(parent_id=None))
                    query_parts.remove(query_part)
                continue

            # Search for status
            if query_part.startswith('status:'):
                self._return_filtered_queryset = True
                value = get_value(query_part, 'status')
                if value == ASSET_STATUS_PRIVATE:
                    filters_.append(Q(owner_id=request.user.id))
                    query_parts.remove(query_part)

                elif value == ASSET_STATUS_SHARED:
                    return get_objects_for_user(
                            user, self._permission, get_queryset())

                elif value == ASSET_STATUS_PUBLIC:
                    public = self.get_public(get_queryset())
                    subscribed = self.get_subscribed(public, user)
                    return subscribed

                elif value == ASSET_STATUS_DISCOVERABLE:
                    discoverable = self.get_discoverable(
                        self.get_public(get_queryset()))
                    # We were asked not to consider subscriptions; return all
                    # discoverable objects
                    return discoverable

                continue

        if skip_subsequent_filtering:
            # if `query_parts` is not empty, user may try to search with
            # fields indexed by Whoosh.
            self._return_filtered_queryset = len(query_parts) == 0

        # Build query to pass to Whoosh with remaining parts
        self._q = ' AND '.join(query_parts)

        return get_queryset()

    def get_owned_and_explicitly_shared(self, queryset, user):
        if user.is_anonymous:
            # Avoid giving anonymous users special treatment when viewing
            # public objects
            owned_and_explicitly_shared = queryset.none()
        else:
            owned_and_explicitly_shared = get_objects_for_user(
                user, self._permission, queryset)

        return owned_and_explicitly_shared

    def get_public(self, queryset):
        return get_objects_for_user(get_anonymous_user(),
                                    self._permission, queryset)

    def get_subscribed(self, queryset, user):
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


class KpiObjectPermissionsFilter(FilteredQuerySetMixin):

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

        skipped_fields = {
            'parent__uid': True,
            'asset_type': True,
            'summary__languages': True,
            'settings__country__value': True,
            'settings__organization': True,
            'settings__sector__value': True,
        }
        queryset = self.get_filtered_queryset(request, queryset, skipped_fields)
        if self._return_filtered_queryset:
            return queryset.distinct()

        owned_and_explicitly_shared = self.get_owned_and_explicitly_shared(
            queryset, user)

        public = self.get_public(queryset)

        if view.action != 'list':
            # Not a list, so discoverability doesn't matter
            return (owned_and_explicitly_shared | public).distinct()

        subscribed = self.get_subscribed(queryset, user)

        return (owned_and_explicitly_shared | subscribed).distinct()


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


class SearchFilter(filters.BaseFilterBackend, FilteredQuerySetMixin):
    """
    Filter objects by searching with Whoosh if the request includes a `q`
    parameter. Another parameter, `parent`, is recognized when its value is an
    empty string; this restricts the queryset to objects without parents.
    """

    library_collection_pattern = re.compile(
        r'\(((?:asset_type:(?:[^ ]+)(?: OR )*)+)\) AND \(parent__uid:([^)]+)\)'
    )

    def filter_queryset(self, request, queryset, view):

        try:
            skipped_fields = {'status': True}
            queryset = self.get_filtered_queryset(request, queryset,
                                                  skipped_fields,
                                                  skip_subsequent_filtering=True)
            if self._return_filtered_queryset:
                return queryset
        except FieldError as e:
            # The user passed a query we recognized as commonly-used, but the
            # field was invalid for the requested model
            return queryset.none()

        # Queries for library questions/blocks inside collections are also
        # common (and buggy when using Whoosh: see #1707)
        q = self._q
        library_collection_match = self.library_collection_pattern.match(q)
        if library_collection_match:
            asset_types = [
                type_query.split(':')[1] for type_query in
                    library_collection_match.groups()[0].split(' OR ')
            ]
            parent__uid = library_collection_match.groups()[1]
            try:
                return queryset.filter(
                    asset_type__in=asset_types,
                    parent__uid=parent__uid
                )
            except FieldError:
                return queryset.none()

        # Fall back to Whoosh
        queryset_pks = list(queryset.values_list('pk', flat=True))
        if not len(queryset_pks):
            return queryset
        # 'q' means do a full-text search of the document fields, where the
        # criteria are given in the Whoosh query language:
        # https://pythonhosted.org/Whoosh/querylang.html
        search_queryset = SearchQuerySet().models(queryset.model)
        search_backend = search_queryset.query.backend
        if not isinstance(search_backend, WhooshSearchBackend):
            raise NotImplementedError(
                'Only the Whoosh search engine is supported at this time')
        if not search_backend.setup_complete:
            search_backend.setup()
        # Parse the user's query
        user_query = QueryParser('text', search_backend.index.schema).parse(q)
        # Construct a query to restrict the search to the appropriate model
        filter_query = Term(DJANGO_CT, get_model_ct(queryset.model))
        # Does the search index for this model have a field that allows
        # filtering by permissions?
        haystack_index = haystack.connections[
            'default'].get_unified_index().get_index(queryset.model)
        if hasattr(haystack_index, 'users_granted_permission'):
            # Also restrict the search to records that the user can access
            filter_query &= Term(
                'users_granted_permission', request.user.username)
        with search_backend.index.searcher() as searcher:
            results = searcher.search(
                user_query,
                filter=filter_query,
                scored=False,
                sortedby=None,
                limit=None
            )
            if not results:
                # We got nothing; is the search index even valid?
                if not searcher.search(filter_query, limit=1):
                    # Thre's not a single entry in the search index for this
                    # model; assume the index is invalid and return the
                    # queryset untouched
                    return queryset
            pk_type = type(queryset_pks[0])
            results_pks = {
                # Coerce each `django_id` from unicode to the appropriate type,
                # usually `int`
                pk_type((x['django_id'])) for x in results
            }
        filter_pks = results_pks.intersection(queryset_pks)
        return queryset.filter(pk__in=filter_pks)


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
