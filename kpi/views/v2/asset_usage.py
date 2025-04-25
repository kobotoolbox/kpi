from drf_spectacular.utils import extend_schema
from rest_framework import renderers, viewsets
from rest_framework.mixins import ListModelMixin

from kpi.models.asset import Asset
from kpi.paginators import AssetUsagePagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import AssetUsageSerializer
from kpi.views.docs.asset_usage.asset_usage_docs import assset_usage_documentation

@extend_schema(
    tags=['Asset-Usage'],
    description=assset_usage_documentation,
)
class AssetUsageViewSet(ListModelMixin, viewsets.GenericViewSet):

    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    permission_classes = (IsAuthenticated,)
    serializer_class = AssetUsageSerializer
    pagination_class = AssetUsagePagination

    def get_queryset(self):
        return Asset.objects.defer('content').filter(owner=self.request.user)
