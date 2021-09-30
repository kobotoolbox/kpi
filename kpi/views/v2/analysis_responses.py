from django.http import Http404
from rest_framework import renderers, status, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.serializers.v2.analysis_responses import AnalysisResponseSerializer
from kpi.paginators import DataPagination
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.models import AnalysisResponses
from kpi.models import Asset
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AnalysisResponsesViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ModelViewSet
):
    model = AnalysisResponses
    lookup_field = 'uid'
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    permission_classes = (
        AssetEditorSubmissionViewerPermission,
    )
    pagination_class = DataPagination
    serializer_class = AnalysisResponseSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = AnalysisResponseSerializer(queryset, many=True)
        if serializer.is_valid():
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            raise Http404

    def retrieve(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(
            uid=kwargs.get('uid')
        )
        serializer = self.get_serializer(
            queryset,
            context=self.get_serializer_context()
        )
        if serializer.is_valid(raise_exception=True):
            return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            asset = Asset.objects.get(uid=kwargs['parent_lookup_asset'])
            serializer.save(asset=asset)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def preform_destroy(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.delete()

    def get_queryset(self):
        return self.model.objects.filter(
            submission_id=self.kwargs['parent_lookup_data'],
        )
