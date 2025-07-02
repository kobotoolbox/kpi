# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, renderers
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedNoUpdateModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.filters import SearchFilter
from kpi.models import SubmissionExportTask
from kpi.permissions import ExportTaskPermission
from kpi.schema_extensions.v2.export_tasks.serializers import (
    ExportResponse,
    ExportCreatePayload,
)
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_204_empty_response, \
    open_api_200_ok_response, open_api_201_created_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Exports'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'export_tasks/create.md'),
        request={'application/json': ExportCreatePayload},
        responses=open_api_201_created_response(
            ExportResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'export_tasks/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('kpi', 'export_tasks/list.md'),
        responses=open_api_200_ok_response(
            ExportResponse,
            validate_payload=False,
            require_auth=False,
        ),
    ),
    partial_update=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'export_tasks/retrieve.md'),
        responses=open_api_200_ok_response(
            ExportResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    update=extend_schema(
        exclude=True,
    ),
)
class ExportTaskViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedNoUpdateModelViewSet
):
    """
   ViewSet for managing the current user's exports


    Available actions:
    - list           → GET /api/v2/assets/{parent_lookup_asset}/exports/
    - create         → POST /api/v2/assets/{parent_lookup_asset}/exports/
    - retrieve       → GET /api/v2/assets/{parent_lookup_asset}/exports/{uid}/
    - delete         → DELETE /api/v2/assets/{parent_lookup_asset}/exports/{uid}/

    Documentation:
    - docs/api/v2/export_tasks/list.md
    - docs/api/v2/export_tasks/create.md
    - docs/api/v2/export_tasks/retrieve.md
    - docs/api/v2/export_tasks/delete.md
    """

    model = SubmissionExportTask
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'
    renderer_classes = [
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    ]
    filter_backends = [
        filters.OrderingFilter,
        SearchFilter,
    ]
    permission_classes = [
        ExportTaskPermission,
    ]
    search_default_field_lookups = [
        'uid__icontains',
    ]
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [('object_id', 'asset.id'), 'asset.owner.username']

    def get_queryset(self):
        user = get_database_user(self.request.user)
        return self.model.objects.filter(
            user=user,
            data__source__icontains=self.kwargs['parent_lookup_asset'],
        )
