from drf_spectacular.utils import extend_schema
from rest_framework import renderers, viewsets
from rest_framework.mixins import ListModelMixin

from kpi.models.asset import Asset
from kpi.paginators import AssetUsagePagination
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.asset_usage.serializers import AssetUsageResponseInlineSerializer  # noqa
from kpi.serializers.v2.service_usage import AssetUsageSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response

@extend_schema(
    tags=['Asset Usage'],
    description=read_md('kpi', 'asset_usage/list.md'),
    responses=open_api_200_ok_response(
        AssetUsageResponseInlineSerializer,
        media_type='application/json',
    ),
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
