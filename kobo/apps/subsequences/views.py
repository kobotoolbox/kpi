from rest_framework import mixins, viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.serializers import (
    QuestionAdvancedActionSerializer,
    QuestionAdvancedActionUpdateSerializer,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class QuestionAdvancedActionViewSet(
    viewsets.GenericViewSet,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
):
    def get_queryset(self):
        return QuestionAdvancedAction.objects.filter(asset=self.asset)
    def perform_create(self, serializer):
        serializer.save(asset=self.asset)
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuestionAdvancedActionUpdateSerializer
        else:
            return QuestionAdvancedActionSerializer
