from django.conf import settings
from django.http import Http404
from rest_framework import (
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.decorators import action
from rest_framework.pagination import _positive_int as positive_int
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

# from kpi.constants import (
#     SUBMISSION_FORMAT_TYPE_JSON,
#     PERM_CHANGE_SUBMISSIONS,
#     PERM_DELETE_SUBMISSIONS,
#     PERM_VALIDATE_SUBMISSIONS,
# )
from kpi.models import (
    Asset,
    DraftNLPModel,
)
from kpi.paginators import DataPagination
from kpi.permissions import (
    DuplicateSubmissionPermission,
    EditSubmissionPermission,
    SubmissionPermission,
    SubmissionValidationStatusPermission,
    ViewSubmissionPermission,
)
from kpi.serializers.v2.draft_nlp import DraftNLPSerializer
from kpi.utils.object_permission import get_database_user


class DraftNlpViewSet(NestedViewSetMixin, viewsets.GenericViewSet):
    model = DraftNLPModel
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )

    # question: what kind of permissions do we want to use
    permission_classes = (
        EditSubmissionPermission,
        SubmissionPermission,
        ViewSubmissionPermission,
        EditSubmissionPermission,
        SubmissionPermission,
    )
    pagination_class = DataPagination
    serializer_class = DraftNLPSerializer

    def list(self, request, *args, **kwargs):
        queryset = DraftNLPModel.objects.all()
        serializer = DraftNLPSerializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk, *args, **kwargs):
        queryset = DraftNLPModel.objects.all()
        try:
            nlp = queryset.filter(
                uid=pk,
                asset__owner=request.user,
            )
            serializer = DraftNLPSerializer(nlp, many=True)
        except ValueError:
            raise Http404
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            try:
                asset = Asset.objects.get(uid=kwargs['parent_lookup_asset'])
                serializer.save(asset=asset)
            except Exception as e:
                raise e
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    # def update(self, request, pk, *args, **kwargs):
    #     draft_nlp = DraftNLPModel.objects.get(uid=pk)
    #     serializer = DraftNLPSerializer(draft_nlp, data=request.data)
    #     if serializer.is_valid(raise_exception=True):
    #         serializer.update(draft_nlp, serializer.data)
    #         return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

    def preform_destroy(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.delete()

    def get_queryset(self):
        return self.model.objects.filter(
            submission_id=self.kwargs['parent_lookup_data']
        )
