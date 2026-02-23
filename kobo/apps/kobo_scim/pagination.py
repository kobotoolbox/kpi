from rest_framework.response import Response

from kpi.paginators import DefaultPagination


class SCIMPagination(DefaultPagination):
    """
    Pagination class that implements SCIM 2.0 list response pagination.
    SCIM uses 1-based `startIndex` and `count` parameters.
    Inherits from KPI `DefaultPagination` to align with internal conventions.
    """

    limit_query_param = 'count'
    offset_query_param = 'startIndex'

    # We maintain standard DefaultPagination sizes, but listen to 'count' & 'startIndex'
    # DefaultPagination expects offset_query_param/limit_query_param to behave cleanly.

    def get_offset(self, request):
        try:
            # SCIM startIndex is 1-based. To map it to an offset (0-based) for the DB:
            # offset = startIndex - 1
            start_index = int(request.query_params.get(self.offset_query_param, 1))
            if start_index < 1:
                start_index = 1
            return start_index - 1
        except (TypeError, ValueError):
            return 0

    def get_paginated_response(self, data):
        # Determine the startIndex being returned.
        # If user passed startIndex=1 => offset was 0, so startIndex is offset + 1.
        start_index = self.offset + 1

        return Response(
            {
                'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
                'totalResults': self.count,
                'itemsPerPage': len(data),
                'startIndex': start_index,
                'Resources': data,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'required': [
                'schemas',
                'totalResults',
                'itemsPerPage',
                'startIndex',
                'Resources',
            ],
            'properties': {
                'schemas': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'example': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
                },
                'totalResults': {'type': 'integer', 'example': 100},
                'itemsPerPage': {'type': 'integer', 'example': 10},
                'startIndex': {'type': 'integer', 'example': 1},
                'Resources': schema,
            },
        }
