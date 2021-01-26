# coding: utf-8
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework_extensions.mixins import NestedViewSetMixin
from rest_framework.decorators import action
from rest_framework.response import Response

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

