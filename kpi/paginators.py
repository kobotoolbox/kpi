# coding: utf-8
from collections import OrderedDict

from django.conf import settings
from django_request_cache import cache_for_request
from rest_framework.pagination import (
    LimitOffsetPagination,
    PageNumberPagination,
)
from rest_framework.response import Response
from rest_framework.reverse import reverse_lazy
from rest_framework.serializers import SerializerMethodField


class DataPagination(LimitOffsetPagination):
    """
    Pagination class for submissions.
    """
    default_limit = settings.SUBMISSION_LIST_LIMIT
    offset_query_param = 'start'
    max_limit = settings.SUBMISSION_LIST_LIMIT


class Paginated(LimitOffsetPagination):
    """ Adds 'root' to the wrapping response object. """
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
    def get_all_asset_ids_from_queryset(queryset):
        # Micro optimization, coerce `asset_ids` as a list to force the query
        # to be processed right now. Otherwise, because queryset is a lazy query,
        # it creates (left) joins on tables when queryset is interpreted
        # and it is way slower than running this extra query.
        #
        # `AssetPagination.get_count()` and `AssetViewSet.get_serializer_context()`
        # use the same query base. So use it here to retrieve `asset_ids`
        # and cache them.
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
                            'type': 'list',
                            'example': ['English (en)']
                        },
                        'countries': {
                            'type': 'list',
                            'example': [['FRA', 'France']]
                        },
                        'sectors': {
                            'type': 'list',
                            'example': [['Public Administration', 'Public Administration']]
                        },
                        'organizations': {
                            'type': 'list',
                            'example': ['Kobotoolbox']
                        }
                    }
                },
                'results': schema,
            }
        }


class TinyPaginated(PageNumberPagination):
    """
    Same as Paginated with a small page size
    """
    page_size = 50
