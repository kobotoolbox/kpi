# coding: utf-8
from rest_framework import viewsets, mixins
from .serializers import ReportsListSerializer, ReportsDetailSerializer

from kpi.models import AssetVersion, Asset
from kpi.models.object_permission import get_objects_for_user, get_anonymous_user
from kpi.constants import PERM_VIEW_SUBMISSIONS


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
        user_assets = get_objects_for_user(self.request.user, PERM_VIEW_SUBMISSIONS, deployed_assets)
        publicly_shared_assets = get_objects_for_user(get_anonymous_user(), PERM_VIEW_SUBMISSIONS, deployed_assets)

        return user_assets | publicly_shared_assets
