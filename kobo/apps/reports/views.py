# coding: utf-8
from rest_framework import viewsets, mixins
from .serializers import ReportsListSerializer, ReportsDetailSerializer

from kpi.models import AssetVersion, Asset
from kpi.models.object_permission import get_objects_for_user


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
        
        # Retrieve all deployed assets first.
        deployed_assets = Asset.objects.filter(asset_versions__deployed=True).distinct()
        # Then retrieve all assets user is allowed to view (user must have 'view_submissions' on Asset objects)
        assets = get_objects_for_user(self.request.user, 'view_submissions', deployed_assets)

        return assets