from django_filters import rest_framework as filters

from kobo.apps.user_reports.models import UserReports


class UserReportsFilter(filters.FilterSet):
    """
    Filter for the `/user-reports` endpoint (materialized view `user_reports_mv`)

    Examples of usage:
    - Filter by username (case-insensitive, starts with):
      `?username=john`
    - Filter by email (case-insensitive, starts with):
        `?email=example`

    - Filter by date joined (greater than or equal to):
        `?date_joined_gte=2023-01-01T00:00:00Z`
    - Filter by date joined (less than or equal to):
        `?date_joined_lte=2023-12-31T23:59:59Z`

    - Filter by total storage bytes (greater than or equal to):
        `?total_storage_bytes_gte=1000000`
    - Filter by total storage bytes (less than or equal to):
        `?total_storage_bytes_lte=5000000`

    - Filter by has subscriptions (boolean):
        `?has_subscriptions=true` or `?has_subscriptions=false`
    - Filter by subscription status (exact match):
        `?subscription_status=active`
    """

    username = filters.CharFilter(field_name='username', lookup_expr='istartswith')
    email = filters.CharFilter(field_name='email', lookup_expr='istartswith')

    date_joined_gte = filters.DateTimeFilter(
        field_name='date_joined', lookup_expr='gte'
    )
    date_joined_lte = filters.DateTimeFilter(
        field_name='date_joined', lookup_expr='lte'
    )
    last_login_gte = filters.DateTimeFilter(field_name='last_login', lookup_expr='gte')
    last_login_lte = filters.DateTimeFilter(field_name='last_login', lookup_expr='lte')
    total_storage_bytes_gte = filters.NumberFilter(
        field_name='storage_bytes_total', lookup_expr='gte'
    )
    total_storage_bytes_lte = filters.NumberFilter(
        field_name='storage_bytes_total', lookup_expr='lte'
    )
    total_submission_count_all_time_gte = filters.NumberFilter(
        field_name='submission_counts_all_time', lookup_expr='gte'
    )
    total_submission_count_all_time_lte = filters.NumberFilter(
        field_name='submission_counts_all_time', lookup_expr='lte'
    )
    total_submission_count_current_period_gte = filters.NumberFilter(
        field_name='current_period_submissions', lookup_expr='gte'
    )
    total_submission_count_current_period_lte = filters.NumberFilter(
        field_name='current_period_submissions', lookup_expr='lte'
    )
    total_nlp_usage_asr_seconds_all_time_gte = filters.NumberFilter(
        field_name='nlp_usage_asr_seconds_total', lookup_expr='gte'
    )
    total_nlp_usage_asr_seconds_all_time_lte = filters.NumberFilter(
        field_name='nlp_usage_asr_seconds_total', lookup_expr='lte'
    )
    total_nlp_usage_mt_characters_all_time_gte = filters.NumberFilter(
        field_name='nlp_usage_mt_characters_total', lookup_expr='gte'
    )
    total_nlp_usage_mt_characters_all_time_lte = filters.NumberFilter(
        field_name='nlp_usage_mt_characters_total', lookup_expr='lte'
    )
    has_subscriptions = filters.BooleanFilter(method='filter_has_subscriptions')
    subscription_status = filters.CharFilter(method='filter_subscription_status')
    subscription_id = filters.CharFilter(method='filter_subscription_id')

    class Meta:
        model = UserReports
        fields = [
            'username',
            'email',
            'date_joined_gte',
            'date_joined_lte',
            'last_login_gte',
            'last_login_lte',
            'total_storage_bytes_gte',
            'total_storage_bytes_lte',
            'total_submission_count_all_time_gte',
            'total_submission_count_all_time_lte',
            'total_submission_count_current_period_gte',
            'total_submission_count_current_period_lte',
            'total_nlp_usage_asr_seconds_all_time_gte',
            'total_nlp_usage_asr_seconds_all_time_lte',
            'total_nlp_usage_mt_characters_all_time_gte',
            'total_nlp_usage_mt_characters_all_time_lte',
            'has_subscriptions',
            'subscription_status',
            'subscription_id',
        ]

    def filter_has_subscriptions(self, queryset, name, value):
        if value is None:
            return queryset

        if value:
            return queryset.exclude(subscriptions=[])
        else:
            return queryset.filter(subscriptions=[])

    def filter_subscription_status(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(subscriptions__contains=[{'status': value}])

    def filter_subscription_id(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(subscriptions__contains=[{'id': value}])
