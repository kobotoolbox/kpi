from django.http import Http404
from rest_framework import renderers, status, viewsets
from rest_framework.decorators import action
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
    lookup_field = 'id'
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    permission_classes = (
        AssetEditorSubmissionViewerPermission,
    )
    pagination_class = DataPagination
    serializer_class = AnalysisResponseSerializer
    # http_method_names = ['get', 'post', 'head', 'options']

    # def list(self, request, *args, **kwargs):
    #

    def retrieve(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(
            submission_id=kwargs['id']
        )
        serializer = self.get_serializer(
            queryset,
            context=self.get_serializer_context(),
            many=True
        )
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
        serializer.save(content='{}')

    def get_queryset(self):
        return self.model.objects.filter(
            asset__uid=self.kwargs['parent_lookup_asset'],
        )

    @action(
        detail=True,
        methods=['GET', 'PUT', 'DELETE'],
        url_path=r'(?P<analysis_question_id>[\d\w\-]+)?',
    )
    def question(self, request, analysis_question_id: str = None, **kwargs):
        queryset = self.get_queryset().get(
            submission_id=kwargs['id']
        )
        serializer = self.get_serializer(
            queryset,
            context=self.get_serializer_context(),
        )
        question_response = serializer.data.get('content').get(analysis_question_id)
        return Response(question_response, status=status.HTTP_200_OK)
