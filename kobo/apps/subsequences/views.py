from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view

from rest_framework import mixins
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.schema_extensions.v2.subsequences.serializers import AdvancedFeatureResponse
from kobo.apps.subsequences.serializers import (
    QuestionAdvancedActionSerializer,
    QuestionAdvancedActionUpdateSerializer,
)
from kpi.permissions import AssetNestedObjectPermission, AssetPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)

@extend_schema(
    tags=['Advanced Features'],
    parameters=[
        OpenApiParameter(
            name='parent_lookup_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent assets',
        ),
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('subsequences', 'subsequences/create.md'),
        responses=open_api_201_created_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    list=extend_schema(
        description=read_md('subsequences', 'subsequences/list.md'),
        responses=open_api_200_ok_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('subsequences', 'subsequences/update.md'),
        responses=open_api_200_ok_response(
            QuestionAdvancedActionUpdateSerializer,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the action',
            ),
        ],
    ),
    retrieve=extend_schema(
        description=read_md('subsequences', 'subsequences/retrieve.md'),
        responses=open_api_200_ok_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the action',
            ),
        ],
    ),
    update=extend_schema(
        exclude=True,
    ),
)
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
    logged_fields = ['asset.owner.username', 'action', 'params',('object_id', 'asset.id'),]
    pagination_class = None
    permission_classes = (AssetPermission,)
    def get_queryset(self):
        return QuestionAdvancedAction.objects.filter(asset=self.asset)
    def perform_create_override(self, serializer):
        serializer.save(asset=self.asset)
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuestionAdvancedActionUpdateSerializer
        else:
            return QuestionAdvancedActionSerializer
