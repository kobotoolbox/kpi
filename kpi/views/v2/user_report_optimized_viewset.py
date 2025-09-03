from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import exceptions, mixins, status, viewsets
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.filters import OrderingFilter, SearchFilter

from kpi.models.user_reports import UserReports
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.user_report_optimized_serializer import (
    OptimizedUserReportSerializer
)
from kpi.utils.user_reports_filters import UserReportsFilter


class OptimizedUserReportsViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """
    ### Basic Filters
    - `email`: Filter by email (case-insensitive contains)
    - `username`: Filter by username (case-insensitive contains)
    - `date_joined_after`: Filter users joined after date (ISO format)
    - `date_joined_before`: Filter users joined before date (ISO format)
    - `last_login_after`: Filter users with last login after date
    - `last_login_before`: Filter users with last login before date

    Example: `/?email=gmail.com&date_joined_after=2023-01-01`

    ### Usage Filters (support min,max ranges)
    - `storage_bytes_total_min/max`: Storage usage filter
    - `submission_counts_current_month_min/max`: Current month submissions
    - `submission_counts_all_time_min/max`: All-time submissions
    - `nlp_usage_asr_seconds_total_min/max`: ASR usage filter
    - `nlp_usage_mt_characters_total_min/max`: MT usage filter
    - `asset_count_min/max`: Asset count filter
    - `deployed_asset_count_min/max`: Deployed asset count filter

    Example: `/?storage_bytes_total_min=1000&storage_bytes_total_max=1000000`

    ### Boolean Filters
    - `is_active`: Filter by active status
    - `is_staff`: Filter by staff status
    - `is_superuser`: Filter by superuser status
    - `validated_email`: Filter by email validation status
    - `validated_password`: Filter by password validation status
    - `mfa_is_active`: Filter by MFA status
    - `sso_is_active`: Filter by SSO status
    - `accepted_tos`: Filter by TOS acceptance status

    Example: `/?is_active=true&validated_email=false`

    ### Advanced Filters
    - `metadata__organization_type`: Filter by organization type in metadata
    - `has_subscriptions`: Filter users with/without subscriptions
    - `subscription_status`: Filter by subscription status

    Example: `/?metadata__organization_type=non-profit&has_subscriptions=true`

    ## Ordering
    - `ordering`: Order by any field (prefix with '-' for descending)
    - Common: `date_joined`, `-last_login`, `username`, `storage_bytes_total`

    Example: `/?ordering=-date_joined`

    ## Search
    - `search`: Full-text search across username, email, first_name, last_name

    Example: `/?search=john`
    """

    queryset = UserReports.objects.all()
    permission_classes = (IsAuthenticated,)
    pagination_class = LimitOffsetPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = UserReportsFilter
    serializer_class = OptimizedUserReportSerializer

    # Ordering configuration
    ordering_fields = [
        'username', 'email', 'date_joined', 'last_login',
        'storage_bytes_total', 'submission_counts_current_month',
        'submission_counts_all_time', 'nlp_usage_asr_seconds_total',
        'nlp_usage_mt_characters_total', 'asset_count', 'deployed_asset_count'
    ]
    ordering = ['username']
    search_fields = ['username', 'email', 'first_name', 'last_name']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset

    def list(self, request, *args, **kwargs):
        # Restrict access to superusers only
        if not request.user.is_superuser:
            raise exceptions.PermissionDenied(
                'Only superusers can access user reports'
            )

        return super().list(request, *args, **kwargs)
