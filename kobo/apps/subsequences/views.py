from rest_framework import mixins
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.serializers import (
    QuestionAdvancedActionSerializer,
    QuestionAdvancedActionUpdateSerializer,
)
from kpi.permissions import AssetAdvancedFeaturesPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class QuestionAdvancedActionViewSet(
    AuditLoggedViewSet,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
):
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [
        'asset.owner.username',
        'action',
        'params',
        ('object_id', 'asset.id'),
    ]
    pagination_class = None
    permission_classes = (AssetAdvancedFeaturesPermission,)

    def get_queryset(self):
        return QuestionAdvancedAction.objects.filter(asset=self.asset)

    def perform_create_override(self, serializer):
        serializer.save(asset=self.asset)

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuestionAdvancedActionUpdateSerializer
        else:
            return QuestionAdvancedActionSerializer
