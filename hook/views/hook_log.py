# -*- coding: utf-8 -*-
from __future__ import absolute_import

from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, mixins, status
from rest_framework.decorators import detail_route, list_route
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from ..models.hook_log import HookLog
from ..serializers.hook_log import HookLogSerializer
from kpi.views import AssetOwnerFilterBackend, SubmissionViewSet


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

    @detail_route(methods=["PATCH"], url_path="retry")
    def retry_detail(self, request, uid=None, *args, **kwargs):
        """
        Retries to send data to external service.
        :param request: rest_framework.request.Request
        :param uid: str
        :return: Response
        """
        hook_log = self.get_object()
        data = self.__get_data(request, hook_log)
        status_code, response = hook_log.retry(data)
        return Response(response, status=status_code)

    @list_route(methods=["POST"], url_path="retry")
    def retry_list(self, request, *args, **kwargs):
        #TODO implement Celery task
        return Response("Retry list")


    def __get_data(self, request, hook_log):
        """
        Retrieves `kc` instance data through `kpi` proxy viewset.

        :param request: HttpRequest
        :param hook_log: Hook
        :return: str
        """
        kwargs = {
            "pk": hook_log.instance_id,
            "parent_lookup_asset": hook_log.hook.asset.uid,
            "format": hook_log.hook.export_type
        }
        request.method = "GET"  # Force request to be a GET instead of PATCH
        view = SubmissionViewSet.as_view({"get": "retrieve"})(request, **kwargs)
        if view.status_code == status.HTTP_200_OK:
            return view.content
        else:
            return None