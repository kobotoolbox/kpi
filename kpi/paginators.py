from collections import OrderedDict
from typing import Union

from django.conf import settings
from django.db.models.query import QuerySet
from django_request_cache import cache_for_request
from rest_framework.pagination import (
    LimitOffsetPagination,
    PageNumberPagination,
)
from rest_framework.response import Response
from rest_framework.reverse import reverse_lazy
from rest_framework.serializers import SerializerMethodField
from rest_framework.utils.urls import replace_query_param


class Paginated(LimitOffsetPagination):
    """
    Adds 'root' to the wrapping response object.
    """
    root = SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class AssetPagination(Paginated):

    def get_paginated_response(self, data, metadata):

        response = OrderedDict([
            ('count', self.count),
            ('next', self.get_next_link()),
            ('previous', self.get_previous_link()),
            ('results', data)
        ])
        if metadata is not None:
            response['metadata'] = metadata

        return Response(response)

    @staticmethod
    @cache_for_request
    def get_all_asset_ids_from_queryset(queryset: Union[QuerySet, list]):
        # Micro optimization, coerce `asset_ids` as a list to force the query
        # to be processed right now. Otherwise, because queryset is a lazy query,
        # it creates (left) joins on tables when queryset is interpreted
        # and it is way slower than running this extra query.
        #
        # `AssetPagination.get_count()` and `AssetViewSet.get_serializer_context()`
        # use the same query base. So use it here to retrieve `asset_ids`
        # and cache them.
        if isinstance(queryset, list):
            asset_ids = [a.pk for a in queryset]
        else:
            asset_ids = list(queryset.values_list('id', flat=True).distinct().order_by())
        return asset_ids

    def get_count(self, queryset):
        """
        Determine total number of assets.
        Use `len()` instead of `queryset.count()`.

        See cls.get_all_asset_ids_from_queryset())
        """
        return len(AssetPagination.get_all_asset_ids_from_queryset(queryset))

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'properties': {
                'count': {
                    'type': 'integer',
                    'example': 123,
                },
                'next': {
                    'type': 'string',
                    'nullable': True,
                },
                'previous': {
                    'type': 'string',
                    'nullable': True,
                },
                'metadata': {
                    'type': 'object',
                    'properties': {
                        'languages': {
                            'type': 'array',
                            'items': {'type': 'string'},
                            'example': ['English (en)']
                        },
                        'countries': {
                            'type': 'array',
                            'items': {
                                'type': 'array',
                                'items': {
                                    'type': 'string',
                                },
                            },
                            'example': [['FRA', 'France']]
                        },
                        'sectors': {
                            'type': 'array',
                            'items': {
                                'type': 'array',
                                'items': {
                                    'type': 'string',
                                },
                            },
                            'example': [['Public Administration', 'Public Administration']]
                        },
                        'organizations': {
                            'type': 'array',
                            'items': {'type': 'string'},
                            'example': ['Kobotoolbox']
                        }
                    }
                },
                'results': schema,
            }
        }


class AssetUsagePagination(PageNumberPagination):
    """
    Pagination class for usage project breakdown table.
    """
    page_size = 8
    page_size_query_param = 'page_size'


class DataPagination(LimitOffsetPagination):
    """
    Pagination class for submissions.
    """
    default_limit = settings.SUBMISSION_LIST_LIMIT
    offset_query_param = 'start'
    max_limit = settings.SUBMISSION_LIST_LIMIT


class FastPagination(Paginated):
    """
    Pagination class optimized for faster counting for DISTINCT queries on large tables.

    This class overrides the get_count() method to only look at the primary key field, avoiding expensive DISTINCTs
    comparing several fields. This may not work for queries with lots of joins, especially with one-to-many or
    many-to-many type relationships.
    """

    def get_count(self, queryset):
        if queryset.query.distinct:
            return queryset.only('pk').count()
        return super().get_count(queryset)


class NoCountPagination(Paginated):
    """
    Omits the 'count' field to avoid expensive COUNT(*) queries.
    """

    def get_paginated_response_schema(self, schema):
        response_schema = super().get_paginated_response_schema(schema)
        del response_schema['properties']['count']
        return response_schema

    def get_paginated_response(self, data):
        return Response(
            {
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'results': data,
            }
        )

    def paginate_queryset(self, queryset, request, view=None):
        self.request = request

        self.limit = self.get_limit(request)
        if self.limit is None:
            return None

        self.offset = self.get_offset(request)

        # Peek one item beyond the current page to see if a next page exists
        items = list(queryset[self.offset:self.offset + self.limit + 1])
        self.has_next = len(items) > self.limit
        return items[:self.limit]

    def get_next_link(self):
        if not self.has_next:
            return None

        url = self.request.build_absolute_uri()
        url = replace_query_param(url, self.limit_query_param, self.limit)

        offset = self.offset + self.limit
        return replace_query_param(url, self.offset_query_param, offset)


class TinyPaginated(PageNumberPagination):
    """
    Same as Paginated with a small page size
    """
    page_size = 50
