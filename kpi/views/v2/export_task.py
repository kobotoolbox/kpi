# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, renderers
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedNoUpdateModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.filters import SearchFilter
from kpi.models import SubmissionExportTask
from kpi.permissions import ExportTaskPermission
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Exports'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'export_tasks/create.md')
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'export_tasks/delete.md')
    ),
    list=extend_schema(
        description=read_md('kpi', 'export_tasks/list.md')
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'export_tasks/update.md')
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'export_tasks/retrieve.md')
    ),
    update=extend_schema(
        exclude=True
    ),
)
class ExportTaskViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedNoUpdateModelViewSet
):
    """

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
