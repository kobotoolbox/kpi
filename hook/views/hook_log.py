# -*- coding: utf-8 -*-
from __future__ import absolute_import

from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin

from ..models.hook_log import HookLog
from ..serializers.hook_log import HookLogSerializer
from kpi.models import Asset
from kpi.views import AssetOwnerFilterBackend


class HookLogViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """
    ### CURRENT ENDPOINT
    """
    model = HookLog

    lookup_field = "uid"
    filter_backends = (
        AssetOwnerFilterBackend,
    )
    serializer_class = HookLogSerializer

    def get_queryset(self):
        asset_uid = self.get_parents_query_dict().get("asset")
        hook_uid = self.get_parents_query_dict().get("hook")
        queryset = self.model.objects.filter(hook__uid=hook_uid, hook__asset__uid=asset_uid)
        queryset = queryset.select_related("hook__asset__uid")

        return queryset