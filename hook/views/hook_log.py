# -*- coding: utf-8 -*-
from __future__ import absolute_import

from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, mixins
from rest_framework.decorators import detail_route, list_route
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from ..models.hook_log import HookLog
from ..serializers.hook_log import HookLogSerializer
from kpi.views import AssetOwnerFilterBackend


class HookLogViewSet(NestedViewSetMixin,
                     mixins.RetrieveModelMixin,
                     mixins.ListModelMixin,
                     viewsets.GenericViewSet):
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

    @detail_route(methods=["POST"], url_path="retry")
    def retry_detail(self, request, uid=None, *args, **kwargs):
        #hook_log = get_object_or_404(uid=uid)
        # TODO implement
        return Response("Retry detail")


    @list_route(methods=["POST"], url_path="retry")
    def retry_list(self, request, *args, **kwargs):
        #TODO implement Celery task
        return Response("Retry list")