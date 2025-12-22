from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.subsequences.constants import SCHEMA_VERSIONS
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kobo.apps.subsequences.serializers import (
    QuestionAdvancedFeatureSerializer,
    QuestionAdvancedFeatureUpdateSerializer,
)
from kobo.apps.subsequences.utils.versioning import migrate_advanced_features
from kpi.permissions import AssetAdvancedFeaturesPermission
from kpi.schema_extensions.v2.subsequences.examples import (
    get_advanced_features_create_examples,
    get_advanced_features_list_examples,
)
from kpi.schema_extensions.v2.subsequences.serializers import (
    AdvancedFeaturePatchRequest,
    AdvancedFeaturePostRequest,
    AdvancedFeatureResponse,
)
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.versioning import APIV2Versioning


@extend_schema(
    tags=['Survey data'],
    parameters=[
        OpenApiParameter(
            name='uid_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('subsequences', 'subsequences/create.md'),
        request={'application/json': AdvancedFeaturePostRequest},
        responses=open_api_201_created_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        examples=get_advanced_features_create_examples(),
    ),
    list=extend_schema(
        description=read_md('subsequences', 'subsequences/list.md'),
        responses=open_api_200_ok_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        examples=get_advanced_features_list_examples(),
    ),
    partial_update=extend_schema(
        description=read_md('subsequences', 'subsequences/update.md'),
        request={'application/json': AdvancedFeaturePatchRequest},
        responses=open_api_200_ok_response(
            AdvancedFeatureResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_advanced_feature',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the advanced feature',
            ),
        ],
        examples=get_advanced_features_create_examples()
        + get_advanced_features_list_examples(),
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
                name='uid_advanced_feature',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the advanced feature',
            ),
        ],
        examples=get_advanced_features_list_examples(),
    ),
    update=extend_schema(
        exclude=True,
    ),
)
class QuestionAdvancedFeatureViewSet(
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
    # FIXME v2 version should be set by default
    versioning_class = APIV2Versioning
    lookup_field = 'uid'
    lookup_url_kwarg = 'uid_advanced_feature'

    def get_queryset(self):
        return QuestionAdvancedFeature.objects.filter(asset=self.asset)

    def perform_create_override(self, serializer):
        if (
            self.asset.advanced_features
            and self.asset.advanced_features.get('version') != SCHEMA_VERSIONS[0]
        ):
            migrate_advanced_features(self.asset)
        serializer.save(asset=self.asset)

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuestionAdvancedFeatureUpdateSerializer
        else:
            return QuestionAdvancedFeatureSerializer

    def list(self, request, *args, **kwargs):
        if (
            self.asset.advanced_features
            and self.asset.advanced_features.get('version') != SCHEMA_VERSIONS[0]
        ):
            migrate_advanced_features(self.asset)
        return super().list(request, *args, **kwargs)
