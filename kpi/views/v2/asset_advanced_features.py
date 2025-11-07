from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.mixins import UpdateModelMixin
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.subsequences.models import QuestionAdvancedAction
from kpi.mixins.asset import AssetViewSetListMixin
from kpi.mixins.object_permission import ObjectPermissionViewSetMixin
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetAdvancedFeaturesViewSet(
    AssetViewSetListMixin,
    ObjectPermissionViewSetMixin,
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    AuditLoggedModelViewSet,
    UpdateModelMixin,
):
    logged_fields = [

    ]
    log_type = AuditType.PROJECT_HISTORY

    def list(self):
        pass
    def partial_update(self, request, *args, **kwargs):

        pass
    pass

class AdvancedFeaturesSerializer(serializers.Serializer):
    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)
        self.asset = kwargs.get('context').get('asset')

    def validate(self, data):
        pass

    def create(self, validated_data):
        self.asset.advanced_features = validated_data
