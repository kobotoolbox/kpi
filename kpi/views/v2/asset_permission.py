# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import Asset, ObjectPermission
from kpi.permissions import AssetEditorPermission
from kpi.serializers.v2.asset_permission import AssetPermissionSerializer


class AssetPermissionViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """

    ### CURRENT ENDPOINT
    """

    URL_NAMESPACE = 'api_v2'

    model = ObjectPermission
    lookup_field = "uid"
    #filter_backends = (
    #    AssetOwnerFilterBackend,
    #)
    serializer_class = AssetPermissionSerializer
    permission_classes = (AssetEditorPermission,)

    @property
    def asset(self):
        if not hasattr(self, '_asset'):
            asset_uid = self.get_parents_query_dict().get("asset")
            asset = get_object_or_404(Asset, uid=asset_uid)
            setattr(self, '_asset', asset)
        return self._asset

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject asset_uid to avoid extra queries to DB inside the serializer.
        @TODO Check if there is a better way to do it?
        """
        return {
            'request': self.request,
            'format': self.format_kwarg,
            'view': self,
            'asset_uid': self.asset.uid
        }

    def get_queryset(self):
        queryset = self.model.objects.filter(object_id=self.asset.pk)
        return queryset

    def list(self, request, *args, **kwargs):
        return super(AssetPermissionViewSet, self).list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)

    #def perform_create(self, serializer):
    #    # Make sure the requesting user has the share_ permission on
    #    # the affected object
    #    codename = serializer.validated_data['permission'].codename
    #    if not self._requesting_user_can_share(affected_object, codename):
    #        raise exceptions.PermissionDenied()
    #    serializer.save()
