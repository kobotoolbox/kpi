# coding: utf-8
from rest_framework import viewsets, mixins
from .serializers import ReportsListSerializer, ReportsDetailSerializer

from kpi.models import AssetVersion, Asset


class ReportsViewSet(mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    lookup_field = 'uid'

    def get_serializer_class(self):
        if self.action == 'list':
            return ReportsListSerializer
        else:
            return ReportsDetailSerializer

    def get_queryset(self):
        # could be combined into a single query
        avs = set(AssetVersion.objects.filter(asset__owner=self.request.user,
                                              deployed=True,
                                              ).values_list('asset_id',
                                                            flat=True))
        return Asset.objects.filter(id__in=avs)
