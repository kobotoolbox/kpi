from django.conf import settings
from django.http import Http404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.asset import Asset
from kpi.permissions import ViewSubmissionPermission
from kpi.schema_extensions.v2.assets.serializers import AssetCountResponse
from kpi.serializers.v2.asset_counts import AssetCountsSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Assets'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'assets/count.md'),
        responses=open_api_200_ok_response(
            AssetCountResponse,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    )
)
class AssetCountsViewSet(
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for managing the current user's asset counts

    Available actions:
    - counts         → GET /api/v2/assets/{parent_lookup_assets}/counts/

    Documentation:
    - docs/api/v2/assets/counts.md
    """
    parent_model = Asset
    permission_classes = [ViewSubmissionPermission]
    renderer_classes = [JSONRenderer]

    def list(self, request, *args, **kwargs):
        if not self.asset.has_deployment:
            raise Http404
        context = self.get_serializer_context()
        context['days'] = request.query_params.get(
            'days', settings.DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS
        )
        serializer = AssetCountsSerializer(self.asset, context=context)
        return Response(serializer.data)
