from django.http import Http404
from rest_framework import (
    renderers,
    status,
    viewsets,
)
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import (
    Asset,
    DraftNLPModel,
)
from kpi.paginators import DataPagination
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.serializers.v2.draft_nlp import DraftNLPSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class DraftNlpViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ModelViewSet
):
    model = DraftNLPModel
    lookup_field = 'uid'
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    permission_classes = (AssetEditorSubmissionViewerPermission,)
    pagination_class = DataPagination
    serializer_class = DraftNLPSerializer

    def list(self, request, *args, **kwargs):
        queryset = DraftNLPModel.objects.filter(
            asset__uid=kwargs.get('parent_lookup_asset'),
            submission_id=kwargs.get('parent_lookup_data'),
        )

        serializer = DraftNLPSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        queryset = DraftNLPModel.objects.all()
        try:
            nlp = queryset.get(
                uid=kwargs.get('uid'),
                asset__owner=request.user,
            )
            serializer = DraftNLPSerializer(
                nlp,
                context=self.get_serializer_context()
            )
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

    def preform_destroy(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.delete()

    def get_queryset(self):
        return self.model.objects.filter(
            submission_id=self.kwargs['parent_lookup_data']
        )

    def partial_update(self, request, *args, **kwargs):
        draft_nlp = self.get_object()
        if not draft_nlp:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(draft_nlp, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_404_NOT_FOUND)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
