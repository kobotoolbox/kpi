# coding: utf-8
from datetime import timedelta

import constance
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.hook.constants import HOOK_LOG_FAILED, HOOK_LOG_PENDING
from kobo.apps.hook.models import Hook, HookLog
from kobo.apps.hook.serializers.v2.hook import HookSerializer
from kobo.apps.hook.tasks import retry_all_task
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_201_created_response, \
    open_api_200_ok_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Hooks'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('hook', 'hooks/create.md'),
        responses=open_api_201_created_response(
            HookSerializer,
        )
    ),
    destroy=extend_schema(
        description=read_md('hook', 'hooks/delete.md')
    ),
    list=extend_schema(
        description=read_md('hook', 'hooks/list.md'),
        responses=open_api_200_ok_response(
            HookSerializer,
        )
    ),
    partial_update=extend_schema(
        description=read_md('hook', 'hooks/update.md')
    ),
    retrieve=extend_schema(
        description=read_md('hook', 'hooks/retrieve.md'),
        responses=open_api_200_ok_response(
            HookSerializer,
        )
    ),
    retry=extend_schema(
        description=read_md('hook', 'hooks/retry.md'),
        responses=open_api_200_ok_response()
    ),
    update=extend_schema(
        exclude=True,
    )
)
class HookViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedModelViewSet
):
    """

    """

    model = Hook
    lookup_field = 'uid'
    serializer_class = HookSerializer
    permission_classes = (AssetEditorSubmissionViewerPermission,)
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [
        'endpoint',
        'active',
        'uid',
        ('object_id', 'asset.id'),
        'asset.owner.username',
    ]
    renderer_classes = [JSONRenderer,]

    def get_queryset(self):
        queryset = self.model.objects.filter(asset__uid=self.asset.uid)
        # Even though we only need 'uid', `select_related('asset__uid')`
        # actually pulled in the entire `kpi_asset` table under Django 1.8. In
        # Django 1.9, "select_related() prohibits non-relational fields for
        # nested relations."
        queryset = queryset.select_related('asset')
        return queryset

    def perform_create_override(self, serializer):
        serializer.save(asset=self.asset)

    @action(detail=True, methods=['PATCH'])
    def retry(self, request, uid=None, *args, **kwargs):
        hook = self.get_object()
        response = {'detail': t('Task successfully scheduled')}
        status_code = status.HTTP_200_OK
        if hook.active:
            threshold = timezone.now() - timedelta(seconds=120)

            records = (
                hook.logs.filter(
                    Q(
                        date_modified__lte=threshold,
                        status=HOOK_LOG_PENDING,
                        tries__gte=constance.config.HOOK_MAX_RETRIES,
                    )
                    | Q(status=HOOK_LOG_FAILED)
                )
                .values_list('id', 'uid')
                .distinct()
            )
            # Prepare lists of ids
            hooklogs_ids = []
            hooklogs_uids = []
            for record in records:
                hooklogs_ids.append(record[0])
                hooklogs_uids.append(record[1])

            if len(records) > 0:
                # Mark all logs as PENDING
                HookLog.objects.filter(id__in=hooklogs_ids).update(
                    status=HOOK_LOG_PENDING
                )
                # Delegate to Celery
                retry_all_task.apply_async(
                    queue='kpi_low_priority_queue', args=(hooklogs_ids,)
                )
                response.update({'pending_uids': hooklogs_uids})

            else:
                response['detail'] = t('No data to retry')
                status_code = status.HTTP_304_NOT_MODIFIED
        else:
            response['detail'] = t('Can not retry on disabled hooks')
            status_code = status.HTTP_400_BAD_REQUEST

        return Response(response, status=status_code)
