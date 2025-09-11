from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter

from kobo.apps.audit_log.permissions import SuperUserPermission
from kpi.models.user_reports import UserReports
from kpi.paginators import LimitStartPagination
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.user_reports.serializers import UserReportsListResponse
from kpi.serializers.v2.user_reports import UserReportsSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from kpi.utils.user_reports_filters import UserReportsFilter


@extend_schema(
    tags=['User Reports'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'user_reports/list.md'),
        responses=open_api_200_ok_response(
            UserReportsListResponse,
            require_auth=False,
            raise_not_found=False,
        ),
    ),
)
class UserReportsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Available actions:
    - list          → GET     /api/v2/user-reports/

    Documentation:
    - docs/api/v2/users_reports/list.md
    """

    queryset = UserReports.objects.all()
    serializer_class = UserReportsSerializer
    pagination_class = LimitStartPagination
    permission_classes = (IsAuthenticated, SuperUserPermission)
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = UserReportsFilter

    ordering_fields = [
        'username', 'email', 'date_joined', 'last_login',
        'storage_bytes_total', 'submission_counts_current_month',
        'submission_counts_all_time', 'nlp_usage_asr_seconds_total',
        'nlp_usage_mt_characters_total', 'asset_count', 'deployed_asset_count'
    ]
    ordering = ['username']
    search_fields = ['username', 'email', 'first_name', 'last_name']
