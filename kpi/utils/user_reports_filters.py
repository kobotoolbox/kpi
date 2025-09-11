from django_filters import rest_framework as filters

from kpi.models.user_reports import UserReports


class UserReportsFilter(filters.FilterSet):
    email = filters.CharFilter(lookup_expr='icontains')
    username = filters.CharFilter(lookup_expr='icontains')
    date_joined = filters.DateTimeFromToRangeFilter(
        field_name='date_joined',
        help_text="Filter by date joined range. Format: YYYY-MM-DDTHH:MM:SSZ"
    )
    last_login = filters.DateTimeFromToRangeFilter(
        field_name='last_login',
        help_text="Filter by last login range. Format: YYYY-MM-DDTHH:MM:SSZ"
    )

    storage_bytes_total = filters.RangeFilter(
        field_name='storage_bytes_total',
        help_text="Filter by storage bytes range. Format: min,max"
    )
    current_period_submissions = filters.RangeFilter(
        field_name='current_period_submissions',
        help_text="Filter by current month submissions range. Format: min,max"
    )
    submission_counts_all_time = filters.RangeFilter(
        field_name='submission_counts_all_time',
        help_text="Filter by all-time submissions range. Format: min,max"
    )
    nlp_usage_asr_seconds_total = filters.RangeFilter(
        field_name='nlp_usage_asr_seconds_total',
        help_text="Filter by total ASR seconds range. Format: min,max"
    )
    nlp_usage_mt_characters_total = filters.RangeFilter(
        field_name='nlp_usage_mt_characters_total',
        help_text="Filter by total MT characters range. Format: min,max"
    )

    # Asset filters
    asset_count = filters.RangeFilter(
        field_name='asset_count',
        help_text="Filter by asset count range. Format: min,max"
    )
    deployed_asset_count = filters.RangeFilter(
        field_name='deployed_asset_count',
        help_text="Filter by deployed asset count range. Format: min,max"
    )

    is_active = filters.BooleanFilter()
    is_staff = filters.BooleanFilter()
    is_superuser = filters.BooleanFilter()
    validated_email = filters.BooleanFilter()
    validated_password = filters.BooleanFilter()
    mfa_is_active = filters.BooleanFilter()
    sso_is_active = filters.BooleanFilter()
    accepted_tos = filters.BooleanFilter()

    metadata__organization_type = filters.CharFilter(
        method='filter_metadata_organization_type',
        help_text="Filter by organization type in metadata"
    )

    # Subscription filters
    has_subscriptions = filters.BooleanFilter(
        method='filter_has_subscriptions',
        help_text="Filter users with/without subscriptions"
    )
    subscription_status = filters.CharFilter(
        method='filter_subscription_status',
        help_text="Filter by subscription status (active, canceled, etc.)"
    )
    subscription_id = filters.CharFilter(
        method='filter_subscription_id',
        help_text="Filter by exact subscription id"
    )

    class Meta:
        model = UserReports
        fields = [
            'email', 'username', 'date_joined', 'last_login',
            'storage_bytes_total', 'current_period_submissions',
            'submission_counts_all_time', 'nlp_usage_asr_seconds_total',
            'nlp_usage_mt_characters_total', 'asset_count', 'deployed_asset_count',
            'is_active', 'is_staff', 'is_superuser', 'validated_email',
            'validated_password', 'mfa_is_active', 'sso_is_active', 'accepted_tos',
            'subscription_id'
        ]

    def filter_metadata_organization_type(self, queryset, name, value):
        if not value:
            return queryset

        # Use raw SQL for JSON filtering with proper indexing
        return queryset.extra(
            where=["metadata::jsonb ->> 'organization_type' ILIKE %s"],
            params=[f'%{value}%']
        )

    def filter_has_subscriptions(self, queryset, name, value):
        """
        Filter users based on whether they have subscriptions
        """
        if value is None:
            return queryset

        if value:
            # Users with subscriptions (non-empty array)
            return queryset.extra(
                where=["jsonb_array_length(subscriptions::jsonb) > 0"]
            )
        else:
            # Users without subscriptions (empty array)
            return queryset.extra(
                where=["jsonb_array_length(subscriptions::jsonb) = 0"]
            )

    def filter_subscription_status(self, queryset, name, value):
        """
        Filter by subscription status within the JSON field
        """
        if not value:
            return queryset

        # Use JSON path query for subscription status
        return queryset.extra(
            where=[
                "EXISTS (SELECT 1 FROM jsonb_array_elements(subscriptions::jsonb) AS sub WHERE sub ->> 'status' = %s)"  # noqa
            ],
            params=[value]
        )

    def filter_subscription_id(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.extra(
            where=[
                "EXISTS (SELECT 1 FROM jsonb_array_elements(subscriptions::jsonb) AS sub WHERE sub ->> 'id' = %s)"
            ],
            params=[value]
        )
