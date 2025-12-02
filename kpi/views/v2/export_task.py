# coding: utf-8
import datetime

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, status
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedNoUpdateModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.filters import SearchFilter
from kpi.models import SubmissionExportTask
from kpi.models.import_export_task import ImportExportStatusChoices
from kpi.permissions import ExportTaskPermission
from kpi.schema_extensions.v2.export_tasks.serializers import (
    ExportCreatePayload,
    ExportResponse,
)
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.permissions import is_user_anonymous
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


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
        description=read_md('kpi', 'export_tasks/create.md'),
        request={'application/json': ExportCreatePayload},
        responses=open_api_201_created_response(
            ExportResponse,
            require_auth=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'export_tasks/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_export',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the export task',
            ),
        ],
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
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_export',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the export task',
            ),
        ],
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
     - list           → GET /api/v2/assets/{uid_asset}/exports/
     - create         → POST /api/v2/assets/{uid_asset}/exports/
     - retrieve       → GET /api/v2/assets/{uid_asset}/exports/{uid_export}/
     - delete         → DELETE /api/v2/assets/{uid_asset}/exports/{uid_export}/

     Documentation:
     - docs/api/v2/export_tasks/list.md
     - docs/api/v2/export_tasks/create.md
     - docs/api/v2/export_tasks/retrieve.md
     - docs/api/v2/export_tasks/delete.md
    """

    model = SubmissionExportTask
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'
    lookup_url_kwarg = 'uid_export'

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
            data__source__icontains=self.kwargs['uid_asset'],
        )

    def create(self, request, *args, **kwargs):
        user = get_database_user(request.user)
        if not is_user_anonymous(user):
            return super().create(request, *args, **kwargs)
        # only allow one anonymous export task to run at a time
        source = reverse(
            'asset-detail', kwargs={'uid_asset': self.asset.uid}, request=request
        )
        SubmissionExportTask.log_and_mark_stuck_as_errored(user, source)
        # to be super sure we don't get stuck on a hanging task, use the same logic as
        # log_and_mark_stuck_as_errored to determine a cutoff date for the oldest
        # running export
        max_export_run_time = getattr(settings, 'CELERY_TASK_TIME_LIMIT', 2100)
        max_allowed_export_age = datetime.timedelta(seconds=max_export_run_time * 4)
        this_moment = timezone.now()
        oldest_allowed_timestamp = this_moment - max_allowed_export_age
        existing_tasks = (
            SubmissionExportTask.objects.filter(
                data__source=source,
                user=user,
                date_created__gt=oldest_allowed_timestamp
            )
            .exclude(
                status__in=(
                    ImportExportStatusChoices.COMPLETE,
                    ImportExportStatusChoices.ERROR,
                )
            )
            .order_by('-date_created')
        )
        if existing_tasks.exists():
            # take the most recent if there are multiples
            existing_task = existing_tasks.first()
            expected_latest_finish = existing_task.date_created + datetime.timedelta(
                seconds=settings.CELERY_TASK_TIME_LIMIT
            )

            retry_after = max(
                5,
                int((expected_latest_finish - timezone.now()).total_seconds()),
            )
            return Response(
                data={
                    'error': f'Another export is already in progress. Please retry in'
                    f' {retry_after} seconds'
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                headers={'Retry-After': retry_after}
            )
        return super().create(request, *args, **kwargs)
