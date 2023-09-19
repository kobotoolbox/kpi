# coding: utf-8
from rest_framework import viewsets

from kpi.filters import SearchFilter
from kpi.permissions import IsAuthenticated


class BaseViewSet(viewsets.ReadOnlyModelViewSet):

    permission_classes = (IsAuthenticated,)
    lookup_field = 'code'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
        'code__icontains'
    ]
