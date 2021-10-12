from rest_framework import renderers, status, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.serializers.v2.analysis_questions import AnalysisQuestionsSerializer
from kpi.paginators import DataPagination
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.models import AnalysisQuestions
from kpi.models import Asset
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AnalysisQuestionsViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ModelViewSet
):
    """
    This endpoint shows coding questions related to submissions

    ## List

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/analysis-questions/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/analysis-questions/

    ## CRUD

    * `asset_uid` - is the unique identifier for a specific asset
    * `analysis_questions_uid` - is the unique identifier for a specific analysis question

    ### Create an analysis question

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/analysis-questions/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/analysis-questions/

    > **Payload**
    >
    >       {
    >           "content": "{
    >
    >           }",
    >       }

    where:

    * "content" (required) includes the json schema for the questions

    ### Retrieve a specific analysis question

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/analysis-questions/<code>{analysis_questions_uid}</code>/
    </pre>

    > Example
    >
    > curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/analysis-questions/aqmXrz5W59cvbw6vfSZQ3NK/

    ### Update an analysis question

    <pre class="prettyprint">
    <b>PUT</b> /api/v2/assets/<code>{asset_uid}</code>/analysis-questions/<code>{analysis_questions_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X PUT https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/analysis-questions/aqmXrz5W59cvbw6vfSZQ3NK/

    > **Payload**
    >
    >       {
    >           "content": {}
    >       }

    ### Delete specific question

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/analysis-questions/<code>{question_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/analysis-questions/aqmXrz5W59cvbw6vfSZQ3NK/

    ### CURRENT ENDPOINT

    """
    model = AnalysisQuestions
    lookup_field = 'uid'
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    permission_classes = (
        AssetEditorSubmissionViewerPermission,
    )
    pagination_class = DataPagination
    serializer_class = AnalysisQuestionsSerializer
    http_method_names = ['get', 'post', 'put', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        queryset = AnalysisQuestions.objects.filter(asset__uid=kwargs['parent_lookup_asset'])
        serializer = self.get_serializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        queryset = self.get_queryset().get(
            uid=kwargs.get('uid')
        )
        serializer = self.get_serializer(queryset)
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
            asset__uid=self.kwargs['parent_lookup_asset'],
        )
