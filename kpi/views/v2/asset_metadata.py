# coding: utf-8
from rest_framework import (
    renderers,
    serializers,
    viewsets,
)
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetMetadata
from kpi.permissions import AssetMetadataPermission
from kpi.serializers.v2.asset_metadata import AssetMetadataSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetMetadataViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):

    model = AssetMetadata
    lookup_field = 'uid'
    serializer_class = AssetMetadataSerializer
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    permission_classes = (AssetMetadataPermission,)

    def get_queryset(self):
        return self.model.objects.filter(asset_id=self.asset.id)

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)
