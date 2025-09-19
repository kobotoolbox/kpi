from django_filters import rest_framework as filters

from kpi.models.user_reports import UserReports


class UserReportsFilter(filters.FilterSet):
    email = filters.CharFilter(lookup_expr='icontains')
    username = filters.CharFilter(lookup_expr='icontains')
    date_joined = filters.DateTimeFromToRangeFilter(field_name='date_joined')
    last_login = filters.DateTimeFromToRangeFilter(field_name='last_login')
    storage_bytes_total = filters.RangeFilter(field_name='storage_bytes_total')
    current_period_submissions = filters.RangeFilter(
        field_name='current_period_submissions'
    )
    submission_counts_all_time = filters.RangeFilter(
        field_name='submission_counts_all_time',
    )
    nlp_usage_asr_seconds_total = filters.RangeFilter(
        field_name='nlp_usage_asr_seconds_total',
    )
    nlp_usage_mt_characters_total = filters.RangeFilter(
        field_name='nlp_usage_mt_characters_total',
    )
    has_subscriptions = filters.BooleanFilter(method='filter_has_subscriptions')
    subscription_status = filters.CharFilter(method='filter_subscription_status')
    subscription_id = filters.CharFilter(method='filter_subscription_id')

    class Meta:
        model = UserReports
        fields = [
            'email', 'username', 'date_joined', 'last_login',
            'storage_bytes_total', 'current_period_submissions',
            'submission_counts_all_time', 'nlp_usage_asr_seconds_total',
            'nlp_usage_mt_characters_total', 'subscription_id'
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
