from rest_framework import viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.serializers import QuestionAdvancedActionUpdateSerializer, \
    QuestionAdvancedActionCreateSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class QuestionAdvancedActionViewSet(viewsets.ModelViewSet, AssetNestedObjectViewsetMixin, NestedViewSetMixin):
    serializer_class = QuestionAdvancedActionUpdateSerializer
    def get_queryset(self):
        return QuestionAdvancedAction.objects.filter(asset=self.asset)
    def perform_create(self, serializer):
        serializer.save(asset=self.asset)
    def get_serializer_class(self):
        if self.action == 'create':
            return QuestionAdvancedActionCreateSerializer
        else:
            return QuestionAdvancedActionUpdateSerializer
