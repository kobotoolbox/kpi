# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.filters import SearchFilter
from .models.region import Region
from .serializers import RegionSerializer


class RegionViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = RegionSerializer
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
    ]
    min_search_characters = 2
    queryset = Region.objects.all()

    @action(detail=True, methods=['GET'])
    def view(self, request, uid):
        return Response({'uid': uid})

    @action(detail=True, methods=['GET'])
    def export(self, request, uid):
        return Response({'status': 'TBD'})
