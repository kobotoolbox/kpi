from django.conf import settings
from django.db import ProgrammingError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from kobo.apps.audit_log.permissions import SuperUserPermission
from kobo.apps.user_reports.models import UserReports
from kobo.apps.user_reports.seralizers import UserReportsSerializer
from kobo.apps.user_reports.utils.filters import UserReportsFilter
from kpi.paginators import LimitOffsetPagination
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.user_reports.serializers import UserReportsListResponse
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(
    tags=['Server logs (superusers)'],
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
    pagination_class = LimitOffsetPagination
    permission_classes = (IsAuthenticated, SuperUserPermission)
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = UserReportsFilter

    ordering_fields = [
        'username',
        'email',
        'date_joined',
        'last_login',
        'storage_bytes_total',
        'current_period_submissions',
        'submission_counts_all_time',
        'nlp_usage_asr_seconds_total',
        'nlp_usage_mt_characters_total',
        'asset_count',
        'deployed_asset_count',
    ]
    ordering = ['username']

    def list(self, request, *args, **kwargs):
        if not settings.STRIPE_ENABLED:
            return Response(
                {
                    'details': 'Stripe must be enabled to access this endpoint.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            return super().list(request, *args, **kwargs)
        except ProgrammingError as e:
            if 'relation "user_reports_userreportsmv" does not exist' in str(e):  # noqa
                return Response(
                    {
                        'details': 'The data source for user reports is missing. '
                        'Please run 0002_create_user_reports_mv to create the '
                        'materialized view: user_reports_userreportsmv.',
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise e
