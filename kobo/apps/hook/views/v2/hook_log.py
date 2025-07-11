# coding: utf-8
from django.utils.translation import gettext as t
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.hook.constants import KOBO_INTERNAL_ERROR_STATUS_CODE
from kobo.apps.hook.filters import HookLogFilter
from kobo.apps.hook.models.hook_log import HookLog
from kobo.apps.hook.serializers.v2.hook_log import HookLogSerializer
from kpi.paginators import TinyPaginated
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('hook', 'logs/list.md')
    ),
    retrieve=extend_schema(
        description=read_md('hook', 'logs/retrieve.md')
    ),
    retry=extend_schema(
        description=read_md('hook', 'logs/retry.md')
    ),
)
class HookLogViewSet(AssetNestedObjectViewsetMixin,
                     NestedViewSetMixin,
                     mixins.RetrieveModelMixin,
                     mixins.ListModelMixin,
                     viewsets.GenericViewSet):
    """
       ViewSet for managing the logs of a given service endpoint

       Available actions:
       - list           → GET       /api/v2/asset/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/
       - retrieve       → GET       /api/v2/asset/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/{uid}/
       - retry          → PATCH     /api/v2/asset/{parent_lookup_asset}/hooks/{parent_lookup_hook}/logs/{uid}/retry

       Documentation:
       - docs/api/v2/history/action.md
       - docs/api/v2/history/export.md
       - docs/api/v2/history/list.md
       """

    model = HookLog

    lookup_field = 'uid'
    serializer_class = HookLogSerializer
    permission_classes = (AssetEditorSubmissionViewerPermission,)
    pagination_class = TinyPaginated
    filter_backends = (DjangoFilterBackend,)
    filterset_class = HookLogFilter

    def get_queryset(self):
        hook_uid = self.get_parents_query_dict().get('hook')
        queryset = self.model.objects.filter(hook__uid=hook_uid,
                                             hook__asset__uid=self.asset_uid)
        # Even though we only need 'uid', `select_related('hook__asset__uid')`
        # actually pulled in the entire `kpi_asset` table under Django 1.8. In
        # Django 1.9+, "select_related() prohibits non-relational fields for
        # nested relations."
        queryset = queryset.select_related('hook__asset')

        return queryset

    @action(detail=True, methods=['PATCH'])
    def retry(self, request, uid=None, *args, **kwargs):
        """
        Retries to send data to external service.
        :param request: rest_framework.request.Request
        :param uid: str
        :return: Response
        """
        response = {'detail': '', 'status_code': KOBO_INTERNAL_ERROR_STATUS_CODE}
        status_code = status.HTTP_200_OK
        hook_log = self.get_object()

        if hook_log.can_retry:
            hook_log.change_status()
            success = hook_log.retry()
            if success:
                # Return status_code of remote server too.
                # `response["status_code"]` is not the same as `status_code`
                response['detail'] = hook_log.message
                response['status_code'] = hook_log.status_code
            else:
                response['detail'] = t(
                    'An error has occurred when sending the data. '
                    'Please try again later.'
                )
                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        else:
            response['detail'] = t('Data is being or has already been processed')
            status_code = status.HTTP_400_BAD_REQUEST

        return Response(response, status=status_code)
