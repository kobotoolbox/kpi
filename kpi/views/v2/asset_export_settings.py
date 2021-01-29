# coding: utf-8
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetExportSettings
from kpi.serializers.v2.asset_export_settings import AssetExportSettingsSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetExportSettingsViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):

    model = AssetExportSettings
    lookup_field = 'uid'
    serializer_class = AssetExportSettingsSerializer
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    def get_queryset(self):
        return self.model.objects.all()

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject asset_uid to avoid extra queries to DB inside the serializer.
        """

        context_ = super().get_serializer_context()
        context_.update({
            'asset_uid': self.asset.uid
        })
        return context_

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)
