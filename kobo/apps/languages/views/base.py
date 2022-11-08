# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kpi.filters import SearchFilter


class BaseViewSet(viewsets.ReadOnlyModelViewSet):

    permission_classes = (IsAuthenticated,)
    lookup_field = 'code'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
        'code__icontains'
    ]
