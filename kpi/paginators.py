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


import time
roundms = lambda x: round(x*1000)
class AssetPagination(Paginated):

    def paginate_queryset(self, queryset, request, view=None):
        self.count = self.get_count(queryset)
        self.limit = self.get_limit(request)
        if self.limit is None:
            return None

        self.offset = self.get_offset(request)
        self.request = request
        if self.count > self.limit and self.template is not None:
            self.display_page_controls = True

        if self.count == 0 or self.offset > self.count:
            return []

        t1 = time.time()
        chonk = list(
            queryset.model.optimize_queryset_for_list(
                queryset.filter(
                    pk__in=list(
                        queryset.values_list('pk', flat=True)[
                            self.offset : self.offset + self.limit
                        ]
                    )
                )
            )
        )
        #chonk = list(queryset.model.optimize_queryset_for_list(queryset[self.offset:self.offset + self.limit]))
        #chonk = list(queryset[self.offset:self.offset + self.limit])
        t2 = time.time()
        print('BIG CHONK took', roundms(t2 - t1))
        return chonk

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

    def get_count(self, queryset):
        t0 = time.time(); c = super().get_count(queryset); t1 = time.time()
        print('COUNT TOOK', roundms(t1 - t0))
        return c

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
