# -*- coding: utf-8 -*-
from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin

from hook.models import Hook
from hook.serializers import HookSerializer
from kpi.models import Asset
from kpi.views import AssetOwnerFilterBackend


class HookViewSet(NestedViewSetMixin, viewsets.ModelViewSet):

    model = Hook
    lookup_field = "uid"
    filter_backends = (
        AssetOwnerFilterBackend,
    )
    serializer_class = HookSerializer

    def get_queryset(self):
        asset_uid = self.get_parents_query_dict().get("asset")
        queryset = self.model.objects.filter(asset__uid=asset_uid)
        queryset = queryset.select_related("asset__uid")
        return queryset

    def perform_create(self, serializer):
        asset_uid = self.get_parents_query_dict().get("asset")
        asset = get_object_or_404(Asset, uid=asset_uid)
        serializer.save(asset=asset)

