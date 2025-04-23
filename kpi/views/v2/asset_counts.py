from django.conf import settings
from django.http import Http404

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.asset import Asset
from kpi.permissions import ViewSubmissionPermission
from kpi.serializers.v2.asset_counts import AssetCountsSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.views.docs.asset_count.asset_count_docs import asset_count_get

@extend_schema(
    tags=['counts'],
)
@extend_schema_view(
    list=extend_schema(
        description=asset_count_get
    )
)
class AssetCountsViewSet(
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):

    parent_model = Asset
    permission_classes = [ViewSubmissionPermission]

    def list(self, request, *args, **kwargs):
        if not self.asset.has_deployment:
            raise Http404
        context = self.get_serializer_context()
        context['days'] = request.query_params.get(
            'days', settings.DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS
        )
        serializer = AssetCountsSerializer(self.asset, context=context)
        return Response(serializer.data)
