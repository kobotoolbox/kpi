from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.filters import SearchFilter
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ImportExportStatusChoices,
    ProjectHistoryLogExportTask,
)
from kpi.paginators import FastPagination, Paginated
from kpi.permissions import IsAuthenticated
from kpi.tasks import export_task_in_background
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_202_accepted_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from .filters import AccessLogPermissionsFilter
from .models import AccessLog, AuditLog, ProjectHistoryLog
from .permissions import SuperUserPermission, ViewProjectHistoryLogsPermission
from .schema_extensions.v2.access_logs.serializers import (
    AccessLogResponse,
    ExportCreateResponse,
    ExportListResponse,
)
from .schema_extensions.v2.audit_logs.serializers import (
    AuditLogResponse,
    ExportHistoryResponse,
    ProjectHistoryLogResponse,
)
from .schema_extensions.v2.history.serializers import (
    HistoryActionResponse,
    HistoryExportResponse,
    HistoryListResponse,
)
from .serializers import (
    AccessLogSerializer,
    AuditLogSerializer,
    ProjectHistoryLogSerializer,
)


@extend_schema(
    tags=['Audit Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'audit_logs/list.md'),
        parameters=[
            OpenApiParameter(
                name='q',
                required=False,
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses=open_api_200_ok_response(
            AuditLogResponse,
            require_auth=False,
            validate_payload=False,
        ),
    )
)
class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """ """

    model = AuditLog
    serializer_class = AuditLogSerializer
    permission_classes = (SuperUserPermission,)
    queryset = (
        AuditLog.objects.select_related('user').all().order_by('-date_created')
    )

    filter_backends = (SearchFilter,)
    # audit logs have no n-to-many fields, so don't bother running "distinct" on
    # search results
    skip_distinct = True

    search_default_field_lookups = [
        'app_label__icontains',
        'model_name__icontains',
        'metadata__icontains',
    ]
    pagination_class = FastPagination


@extend_schema_view(
    list=extend_schema(
        tags=['Access Logs'],
        description=read_md('audit_log', 'access_logs/list'),
        responses=open_api_200_ok_response(
            AccessLogResponse,
            require_auth=False,
            validate_payload=False,
            raise_not_found=False,
        ),
    )
)
class AllAccessLogViewSet(AuditLogViewSet):
    """
    ViewSet for managing all users' access logs. Only available to superusers.

    Available actions:
    - list       → GET /api/v2/access-logs/

    Documentation:
    - docs/api/v2/access_logs/list.md
    """
    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    serializer_class = AccessLogSerializer
    pagination_class = Paginated


@extend_schema_view(
    list=extend_schema(
        tags=['Access Logs'],
        description=read_md('audit_log', 'access_logs/me/list'),
        responses=open_api_200_ok_response(
            AccessLogResponse,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
    )
)
class AccessLogViewSet(AuditLogViewSet):
    """
    ViewSet for listing a user's access logs

    Available actions:
    - list       → GET /api/v2/access-logs/me/

    Documentation:
    - docs/api/v2/access_logs/me/list.md
    """

    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    permission_classes = (IsAuthenticated,)
    filter_backends = (AccessLogPermissionsFilter,)
    serializer_class = AccessLogSerializer
    pagination_class = Paginated


@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'project_history_logs/list.md'),
        responses=open_api_200_ok_response(
            ProjectHistoryLogResponse,
            require_auth=False,
            validate_payload=False,
        ),
        tags=['Project History Logs'],
    )
)
class AllProjectHistoryLogViewSet(AuditLogViewSet):
    """
    ViewSet for managing the all projects history

    Available actions:
    - list        → GET  /api/v2/asset/project-history-logs/
    - export        → GET  /api/v2/asset/project-history-logs/export/
    - export        → POST /api/v2/asset/project-history-logs/export/

    Documentation:
    - docs/api/v2/project-history-log/list.md
    - docs/api/v2/project-history-log/export_create.md
    - docs/api/v2/project-history-log/export_list.md
    """

    queryset = ProjectHistoryLog.objects.all().order_by('-date_created')
    serializer_class = ProjectHistoryLogSerializer

    @extend_schema(
        methods=['GET'],
        description=read_md(
            'audit_log', 'project_history_logs/export_list.md'
        ),
        responses=open_api_202_accepted_response(
            ExportHistoryResponse,
            require_auth=False,
            validate_payload=False,
        ),
        tags=['Project History Logs'],
    )
    @extend_schema(
        methods=['POST'],
        description=read_md(
            'audit_log', 'project_history_logs/export_create.md'
        ),
        request=None,
        responses=open_api_202_accepted_response(
            ExportHistoryResponse,
            require_auth=False,
            validate_payload=False,
        ),
        tags=['Project History Logs'],
    )
    @action(detail=False, methods=['GET', 'POST'])
    def export(self, request, *args, **kwargs):
        in_progress = ProjectHistoryLogExportTask.objects.filter(
            user=request.user,
            asset_uid=None,
            status=ImportExportStatusChoices.PROCESSING,
        ).count()
        if in_progress > 0:
            return Response(
                {
                    'error': (
                        'Export task for all project history logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        export_task = ProjectHistoryLogExportTask.objects.create(
            user=request.user,
            asset_uid=None,
            data={
                'type': 'project_history_logs_export',
            },
        )
        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.ProjectHistoryLogExportTask',
            )
        )

        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(
    tags=['History'],
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
    actions=extend_schema(
        description=read_md('audit_log', 'history/action.md'),
        responses=open_api_200_ok_response(
            HistoryActionResponse,
            require_auth=False,
            validate_payload=False,
        ),
    ),
    export=extend_schema(
        description=read_md('audit_log', 'history/export.md'),
        request=None,
        responses=open_api_202_accepted_response(
            HistoryExportResponse,
            require_auth=False,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('audit_log', 'history/list.md'),
        responses=open_api_200_ok_response(
            HistoryListResponse,
            require_auth=False,
            validate_payload=False,
        ),
    ),
)
class ProjectHistoryLogViewSet(
    AuditLogViewSet, AssetNestedObjectViewsetMixin, NestedViewSetMixin
):
    """
    ViewSet for managing the current project's history

    Available actions:
    - action        → GET   /api/v2/asset/{parent_lookup_asset}/history/action/
    - export        → POST  /api/v2/asset/{parent_lookup_asset}/history/
    - list          → GET   /api/v2/asset/{parent_lookup_asset}/history/

    Documentation:
    - docs/api/v2/history/action.md
    - docs/api/v2/history/export.md
    - docs/api/v2/history/list.md
    """

    serializer_class = ProjectHistoryLogSerializer
    model = ProjectHistoryLog
    permission_classes = (ViewProjectHistoryLogsPermission,)
    lookup_field = 'uid'

    def get_queryset(self):
        return self.model.objects.filter(metadata__asset_uid=self.asset_uid).order_by(
            '-date_created'
        )

    @action(detail=False, methods=['GET'])
    def actions(self, request, *args, **kwargs):
        actions = (
            self.model.objects.filter(metadata__asset_uid=self.asset_uid)
            .values_list('action')
            .distinct()
        )
        flattened = [action[0] for action in actions]
        return Response({'actions': flattened})

    @action(detail=False, methods=['POST'])
    def export(self, request, *args, **kwargs):
        in_progress = ProjectHistoryLogExportTask.objects.filter(
            user=request.user,
            asset_uid=self.asset_uid,
            status=ImportExportStatusChoices.PROCESSING,
        ).count()
        if in_progress > 0:
            return Response(
                {
                    'error': (
                        'Export task for project history logs for this asset already in'
                        ' progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        export_task = ProjectHistoryLogExportTask.objects.create(
            user=request.user,
            asset_uid=self.asset_uid,
            data={
                'type': 'project_history_logs_export',
            },
        )

        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.ProjectHistoryLogExportTask',
            )
        )
        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


class BaseAccessLogsExportViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'

    # By default, we explicitly set the pagination class because drf-spectacular uses
    # the `pagination_class` to generate the schema — even if the actual response
    # from the viewset actions does not use pagination.
    # If `pagination_class` is not specified, drf-spectacular falls back to the global
    # DRF setting, which can result in incorrect schema generation.
    pagination_class = None

    # We explicitly set `renderer_classes` because drf-spectacular uses it to generate
    # the schema, even if the viewset doesn’t override the renderers or return content
    # that would need them. Without this, it falls back to the default DRF settings,
    # which may not reflect the actual behavior of the viewset.
    renderer_classes = (JSONRenderer,)

    def create_task(self, request, get_all_logs):

        export_task = AccessLogExportTask.objects.create(
            user=request.user,
            get_all_logs=get_all_logs,
            data={
                'type': 'access_logs_export',
            },
        )
        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.AccessLogExportTask',
            )
        )

        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )

    def list_tasks(self, user=None):
        tasks = AccessLogExportTask.objects.all()
        if user is not None:
            tasks = tasks.filter(user=user)
        tasks = tasks.order_by('-date_created')

        tasks_data = [
            {'uid': task.uid, 'status': task.status, 'date_created': task.date_created}
            for task in tasks
        ]

        return Response(tasks_data, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Access Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'access_logs/me/exports/list'),
        request=None,
        responses=open_api_200_ok_response(
            ExportListResponse,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
    ),
    create=extend_schema(
        description=read_md('audit_log', 'access_logs/me/exports/create'),
        request=None,
        responses=open_api_202_accepted_response(
            ExportCreateResponse,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
    ),
)
class AccessLogsExportViewSet(BaseAccessLogsExportViewSet):
    """
    ViewSet for managing the current user's access logs export

    Available actions:
    - list       → GET /api/v2/access-logs/me/export/
    - create     → POST /api/v2/access-logs/me/export/

    Documentation:
    - docs/api/v2/access_logs/me/exports/list.md
    - docs/api/v2/access_logs/me/exports/create.md
    """

    def create(self, request, *args, **kwargs):
        if AccessLogExportTask.objects.filter(
            user=request.user,
            status=ImportExportStatusChoices.PROCESSING,
            get_all_logs=False,
        ).exists():
            return Response(
                {
                    'error': (
                        'Export task for user access logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self.create_task(request, get_all_logs=False)

    def list(self, request, *args, **kwargs):
        return self.list_tasks(request.user)


@extend_schema(
    tags=['Access Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'access_logs/exports/list'),
        request=None,
        responses=open_api_200_ok_response(
            ExportListResponse,
            require_auth=False,
            validate_payload=False,
            raise_not_found=False,
        ),
    ),
    create=extend_schema(
        description=read_md('audit_log', 'access_logs/exports/create'),
        request=None,
        responses=open_api_202_accepted_response(
            ExportCreateResponse,
            raise_not_found=False,
            validate_payload=False,
        ),
    ),
)
class AllAccessLogsExportViewSet(BaseAccessLogsExportViewSet):
    """
    ViewSet for managing exports of every users' access logs


    Available actions:
    - list       → GET /api/v2/access-logs/export/
    - create     → POST /api/v2/access-logs/export/

    Documentation:
    - docs/api/v2/access_logs/exports/list.md
    - docs/api/v2/access_logs/exports/create.md
    """

    permission_classes = (SuperUserPermission,)

    def create(self, request, *args, **kwargs):
        # Check if the superuser has a task running for all
        if AccessLogExportTask.objects.filter(
            user=request.user,
            status=ImportExportStatusChoices.PROCESSING,
            get_all_logs=True,
        ).exists():
            return Response(
                {
                    'error': (
                        'Export task for all access logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self.create_task(request, get_all_logs=True)

    def list(self, request, *args, **kwargs):
        return self.list_tasks()
