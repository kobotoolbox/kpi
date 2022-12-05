# coding: utf-8
from django.db.models import Q
from django.db.models.query import QuerySet
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.filters import SearchFilter
from kpi.models import Asset
from kpi.serializers.v2.asset import AssetMetadataListSerializer
from kpi.utils.regional_views import (
    get_region_for_view,
    user_has_view_perms,
)
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

    def get_queryset(self, *args, **kwargs):
        return self.queryset.filter(users=self.request.user)

    @action(detail=True, methods=['GET'])
    def assets(self, request, uid):
        assets = Asset.objects.all()
        if not user_has_view_perms(request.user, uid):
            raise Http404
        queryset = self.filter_queryset(
            self._get_regional_queryset(assets, uid)
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self._get_asset_metadata_serializer(page)
            return self.get_paginated_response(serializer.data)

        serializer = self._get_asset_metadata_serializer(queryset)
        return Response(serializer.data)

    @action(detail=True, methods=['GET'])
    def export(self, request, uid):
        return Response({'status': 'TBD'})

    def get_serializer_context(self):
        context_ = super().get_serializer_context()
        context_['request'] = self.request
        return context_

    def _get_asset_metadata_serializer(self, queryset):
        return AssetMetadataListSerializer(
            queryset,
            many=True,
            read_only=True,
            context=self.get_serializer_context(),
        )

    @staticmethod
    def _get_regional_queryset(queryset: QuerySet, view: str) -> QuerySet:
        region = get_region_for_view(view)
        if '*' in region:
            return queryset

        q = Q(settings__country__in=region)
        for country in region:
            q |= Q(settings__country__contains=[{'value': country}])
        return queryset.filter(q)
