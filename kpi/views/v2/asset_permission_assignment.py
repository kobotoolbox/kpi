from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as t
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import exceptions, status
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    RetrieveModelMixin,
)
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.constants import (
    CLONE_ARG_NAME,
    PERM_ADD_SUBMISSIONS,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission
from kpi.permissions import AssetPermissionAssignmentPermission
from kpi.schema_extensions.v2.asset_permission_assignments.schema import (
    ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA,
    PERMISSION_URL_SCHEMA,
)
from kpi.schema_extensions.v2.asset_permission_assignments.serializers import (
    PermissionAssignmentBulkRequest,
    PermissionAssignmentCloneRequest,
    PermissionAssignmentCreateRequest,
    PermissionAssignmentResponse,
)
from kpi.schema_extensions.v2.generic.schema import USER_URL_SCHEMA
from kpi.serializers.v2.asset_permission_assignment import (
    AssetBulkInsertPermissionSerializer,
    AssetPermissionAssignmentSerializer,
)
from kpi.utils.object_permission import get_user_permission_assignments_queryset
from kpi.utils.schema_extensions.examples import generate_example_from_schema
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_204_empty_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Manage permissions'],
    parameters=[
        OpenApiParameter(
            name='uid_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
        OpenApiParameter(
            name='uid_permission_assignment',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the permission assignment',
        ),
    ],
)
@extend_schema_view(
    bulk_assignments=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/bulk.md'),
        request={'application/json': PermissionAssignmentBulkRequest(many=True)},
        responses=open_api_200_ok_response(
            PermissionAssignmentResponse(many=True),
            require_auth=False,
        ),
    ),
    clone=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/clone.md'),
        request={'application/json': PermissionAssignmentCloneRequest},
        responses=open_api_200_ok_response(
            PermissionAssignmentResponse(many=True),
            require_auth=False,
        ),
    ),
    create=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/create.md'),
        request={'application/json': PermissionAssignmentCreateRequest},
        responses=open_api_200_ok_response(
            PermissionAssignmentResponse,
            require_auth=False,
        ),
        examples=[
            OpenApiExample(
                name='Create partial permission',
                value={
                    'user': generate_example_from_schema(USER_URL_SCHEMA),
                    'partial_permission': generate_example_from_schema(
                        ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA
                    ),
                    'permission': generate_example_from_schema(PERMISSION_URL_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Create permission',
                value={
                    'user': generate_example_from_schema(USER_URL_SCHEMA),
                    'permission': generate_example_from_schema(PERMISSION_URL_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    delete_all=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/delete_all.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the permission',
            ),
        ],
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the permission',
            ),
        ],
    ),
    list=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/list.md'),
        responses=open_api_200_ok_response(
            PermissionAssignmentResponse,
            require_auth=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'asset_permission_assignments/retrieve.md'),
        responses=open_api_200_ok_response(
            PermissionAssignmentResponse,
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the permission',
            ),
        ],
    ),
)
class AssetPermissionAssignmentViewSet(
    AuditLoggedViewSet,
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    CreateModelMixin,
    RetrieveModelMixin,
    DestroyModelMixin,
    ListModelMixin,
):
    """
    Viewset for managing the assignment permission for current project

    Available actions:
    - bulk            → DELETE /api/v2/assets/{uid_asset}/permission-assignments/bulk/  # noqa
    - clone           → PATCH /api/v2/assets/{uid_asset}/permission-assignments/clone/  # noqa
    - create          → DELETE /api/v2/assets/{uid_asset}/permission-assignments/  # noqa
    - delete          → POST /api/v2/assets/{uid_asset}/permission-assignments/{uid_permission_assignment}/  # noqa
    - delete_all      → GET /api/v2/assets/{uid_asset}/permission-assignments/delete-all/  # noqa
    - list            → GET /api/v2/assets/{uid_asset}/permission-assignments/
    - retrieve        → GET /api/v2/assets/{uid_asset}/permission-assignments/{uid_permission_assignment}/  # noqa

    Documentation:
    - docs/api/v2/asset_permission_assignments/bulk.md
    - docs/api/v2/asset_permission_assignments/clone.md
    - docs/api/v2/asset_permission_assignments/create.md
    - docs/api/v2/asset_permission_assignments/delete.md
    - docs/api/v2/asset_permission_assignments/delete_all.md
    - docs/api/v2/asset_permission_assignments/list.md
    - docs/api/v2/asset_permission_assignments/retrieve.md
    - docs/api/v2/asset_permission_assignments/update.md
    """

    model = ObjectPermission
    lookup_field = 'uid'
    lookup_url_kwarg = 'uid_permission_assignment'
    serializer_class = AssetPermissionAssignmentSerializer
    permission_classes = (AssetPermissionAssignmentPermission,)
    pagination_class = None
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = ['asset.id', 'asset.owner.username']
    # filter_backends = Just kidding! Look at this instead:
    #     kpi.utils.object_permission.get_user_permission_assignments_queryset

    @action(
        detail=False,
        methods=['POST'],
        url_path='bulk',
    )
    def bulk_assignments(self, request, *args, **kwargs):
        """
        Assigns all permissions at once for the same asset.

        :param request:
        :return: JSON
        """
        request._request.updated_data = {
            'asset.id': self.asset.id,
            'asset.owner.username': self.asset.owner.username,
        }
        serializer = AssetBulkInsertPermissionSerializer(
            data={'assignments': request.data},
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self.list(request, *args, **kwargs)

    @action(
        detail=False,
        methods=['PATCH'],
    )
    def clone(self, request, *args, **kwargs):
        source_asset_uid = self.request.data[CLONE_ARG_NAME]
        source_asset = get_object_or_404(Asset, uid=source_asset_uid)
        user = request.user
        request._request.initial_data = {
            'asset.id': self.asset.id,
            'asset.owner.username': self.asset.owner.username,
        }

        if user.has_perm(PERM_MANAGE_ASSET, self.asset) and user.has_perm(
            PERM_VIEW_ASSET, source_asset
        ):
            if not self.asset.copy_permissions_from(source_asset):
                http_status = status.HTTP_400_BAD_REQUEST
                response = {
                    'detail': t(
                        "Source and destination objects don't "
                        'seem to have the same type'
                    )
                }
                return Response(response, status=http_status)
        else:
            raise exceptions.PermissionDenied()

        # returns asset permissions. Users who can change permissions can
        # see all permissions.
        return self.list(request, *args, **kwargs)

    @action(
        detail=True,
        methods=['DELETE'],
        url_path='delete-all',
    )
    def delete_all(self, request, *args, **kwargs):
        object_permission = self.get_object()
        user = object_permission.user
        with transaction.atomic():
            response = self.destroy(request, *args, **kwargs)
            if response.status_code == status.HTTP_204_NO_CONTENT:
                self.asset.remove_perm(user, PERM_ADD_SUBMISSIONS)
        return response

    def destroy(self, request, *args, **kwargs):
        object_permission = self.get_object()
        user = object_permission.user
        # If the user is not the owner of the asset, but trying to delete the
        # owner's permissions, raise permission denied error. However, if they
        # are the owner of the asset, they should also be prevented from
        # deleting their own permissions, but given a more appropriate
        # response. Only those with `manage_asset` permissions can delete all
        # permissions from other non-owners with whom the form is shared.
        if (
            not request.user.has_perm(PERM_MANAGE_ASSET, self.asset)
            and (request.user.pk != self.asset.owner_id)
            and (request.user.pk != user.pk)
        ):
            raise exceptions.PermissionDenied()
        elif user.pk == self.asset.owner_id:
            return Response(
                {'detail': t("Owner's permissions cannot be deleted")},
                status=status.HTTP_409_CONFLICT,
            )
        # we don't call perform_destroy, so manually attach the relevant
        # information to the request
        request._request.initial_data = {
            'asset.id': self.asset.id,
            'asset.owner.username': self.asset.owner.username,
        }
        codename = object_permission.permission.codename
        self.asset.remove_perm(user, codename)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        Inject asset_uid and asset to avoid extra queries to DB inside
        the serializer.
        """

        context_ = super().get_serializer_context()
        context_.update(
            {
                'asset_uid': self.asset.uid,
                'asset': self.asset,
            }
        )
        return context_

    def get_queryset(self):
        return get_user_permission_assignments_queryset(
            self.asset, self.request.user
        )

    def perform_create_override(self, serializer):
        serializer.save(asset=self.asset)
