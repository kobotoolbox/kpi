from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, status, viewsets
from rest_framework_extensions.mixins import NestedViewSetMixin
from rest_framework.response import Response

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.subsequences.audit import create_bulk_action_history_log
from kobo.apps.subsequences.constants import SCHEMA_VERSIONS
from kobo.apps.subsequences.models import (
    QATagTracker,
    QuestionAdvancedFeature,
    SubsequenceBulkAction,
)
from kobo.apps.subsequences.serializers import (
    BulkAcceptSerializer,
    BulkActionCancelSerializer,
    BulkActionCreateSerializer,
    BulkActionResponseSerializer,
    QATagTrackerSerializer,
    QuestionAdvancedFeatureSerializer,
    QuestionAdvancedFeatureUpdateSerializer,
)
from kobo.apps.subsequences.utils.versioning import migrate_advanced_features
from kpi.permissions import (
    AdvancedSubmissionPermission,
    AssetAdvancedFeaturesPermission
)
from kpi.schema_extensions.v2.subsequences.examples import (
    get_bulk_accept_examples,
    get_bulk_action_list_response_examples,
    get_bulk_action_patch_examples,
    get_bulk_action_response_examples,
    get_bulk_action_retrieve_examples,
    get_bulk_actions_create_examples,
    get_advanced_features_create_examples,
    get_advanced_features_list_examples,
    get_advanced_features_update_examples,
    get_qa_tag_trackers_list_examples,
)
from kpi.schema_extensions.v2.subsequences.serializers import (
    AdvancedFeatureCreateResponse,
    AdvancedFeaturePatchRequest,
    AdvancedFeaturePostRequest,
    AdvancedFeatureResponse,
    BulkAcceptRequest,
    BulkAcceptResponse,
    BulkActionCreateRequest,
    BulkActionCreateResponse,
    BulkActionListResponse,
    BulkActionPatchRequest,
    BulkActionResponse,
    QATagTrackerResponse,
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
            AdvancedFeatureCreateResponse,
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
        examples=get_advanced_features_update_examples()
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
        description=read_md('subsequences', 'subsequences/bulk_actions_create.md'),
        request={'application/json': BulkActionCreateRequest},
        responses=open_api_201_created_response(
            BulkActionCreateResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        examples=(
            get_bulk_actions_create_examples()
            + get_bulk_action_response_examples()
        ),
    ),
    list=extend_schema(
        description=read_md('subsequences', 'subsequences/bulk_actions_list.md'),
        responses=open_api_200_ok_response(
            BulkActionListResponse(many=False),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        examples=get_bulk_action_list_response_examples(),
    ),
    partial_update=extend_schema(
        description=read_md('subsequences', 'subsequences/bulk_actions_update.md'),
        request={'application/json': BulkActionPatchRequest},
        responses=open_api_200_ok_response(
            BulkActionResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='action_uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the bulk action job',
            ),
        ],
        examples=get_bulk_action_patch_examples(),
    ),
    retrieve=extend_schema(
        description=read_md('subsequences', 'subsequences/bulk_actions_retrieve.md'),
        responses=open_api_200_ok_response(
            BulkActionResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='action_uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the bulk action job',
            ),
        ],
        examples=get_bulk_action_retrieve_examples(),
    ),
)
class BulkActionViewSet(
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = (AssetAdvancedFeaturesPermission,)
    versioning_class = APIV2Versioning
    lookup_field = 'uid'
    lookup_url_kwarg = 'action_uid'

    def get_queryset(self):
        return (
            SubsequenceBulkAction.objects.filter(asset=self.asset)
            .prefetch_related('items')
            .order_by('-date_created')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return BulkActionCreateSerializer
        if self.action == 'partial_update':
            return BulkActionCancelSerializer
        return BulkActionResponseSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['asset'] = self.asset
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        skipped_uuids = instance.skipped_uuids

        # Re-fetch the instance to ensure all related data is included
        # (e.g. for response serialization)
        instance = self.get_queryset().get(pk=instance.pk)
        create_bulk_action_history_log(request, instance)
        response_data = BulkActionResponseSerializer(instance).data
        response_data['skipped_uuids'] = skipped_uuids
        return Response(response_data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance = self.get_queryset().get(pk=instance.pk)
        response_serializer = BulkActionResponseSerializer(instance)
        return Response(response_serializer.data)


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
    methods=['POST'],
    request={'application/json': BulkAcceptRequest},
    responses=open_api_200_ok_response(
        BulkAcceptResponse,
        require_auth=False,
        raise_access_forbidden=False,
    ),
    description=read_md('subsequences', 'subsequences/bulk_accept.md'),
    examples=get_bulk_accept_examples(),
)
class BulkAcceptViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.GenericViewSet
):
    """
    POST /api/v2/assets/{uid_asset}/data/supplements/bulk/

    Accepts NLP results (transcription or translation) in bulk for the given
    submission UUIDs. Returns the count of records that were successfully
    accepted.
    """

    permission_classes = (AssetAdvancedFeaturesPermission,)
    versioning_class = APIV2Versioning
    http_method_names = ['post']

    def create(self, request, *args, **kwargs):
        serializer = BulkAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        accepted_count = serializer.accept(self.asset)
        return Response(
            {
                'accepted_count': accepted_count
            },
            status=status.HTTP_200_OK
        )


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
        OpenApiParameter(
            name='uid_qa_question',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UUID of the QA tags question',
        ),
    ],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('subsequences', 'subsequences/qa_tag_trackers_list.md'),
        responses=open_api_200_ok_response(
            QATagTrackerResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        examples=get_qa_tag_trackers_list_examples(),
    ),
)
class QATagTrackerViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET /api/v2/assets/{uid_asset}/qual-questions/{uid_qa_question}/tags/

    Lists previously tracked tag values for a QA tags question, for use in
    frontend autocomplete suggestions.
    """

    serializer_class = QATagTrackerSerializer
    permission_classes = (AdvancedSubmissionPermission,)
    versioning_class = APIV2Versioning
    pagination_class = None
    http_method_names = ['get']

    def get_queryset(self):
        return QATagTracker.objects.filter(
            asset=self.asset,
            question_uuid=self.kwargs['uid_qa_question'],
        ).order_by('value')
