from rest_framework import serializers

from kpi.schema_extensions.v2.me.fields import SocialAccountField
from kpi.schema_extensions.v2.service_usage.fields import BalancesField, NlpUsageField
from kpi.schema_extensions.v2.user_reports.fields import (
    ExtraDetailsField,
    OrganizationsField,
    SubmissionCountField,
    SubscriptionsField,
)
from kpi.utils.schema_extensions.serializers import inline_serializer_class

ServiceUsageResponse = inline_serializer_class(
    name='UserReportsServiceUsageResponse',
    fields={
        'total_nlp_usage': NlpUsageField(),
        'total_storage_bytes': serializers.IntegerField(),
        'total_submission_count': SubmissionCountField(),
        'balances': BalancesField(),
        'current_period_start': serializers.DateTimeField(),
        'current_period_end': serializers.DateTimeField(),
        'last_updated': serializers.DateTimeField(),
    },
)

UserReportsListResponse = inline_serializer_class(
    name='UserReportsListResponse',
    fields={
        'user_uid': serializers.CharField(),
        'username': serializers.CharField(),
        'first_name': serializers.CharField(),
        'last_name': serializers.CharField(),
        'email': serializers.EmailField(),
        'is_superuser': serializers.BooleanField(),
        'is_staff': serializers.BooleanField(),
        'is_active': serializers.BooleanField(),
        'date_joined': serializers.DateTimeField(),
        'last_login': serializers.DateTimeField(),
        'validated_email': serializers.BooleanField(),
        'mfa_is_active': serializers.BooleanField(),
        'sso_is_active': serializers.BooleanField(),
        'accepted_tos': serializers.BooleanField(),
        'social_accounts': SocialAccountField(),
        'organizations': OrganizationsField(),
        'extra_details': ExtraDetailsField(),
        'subscriptions': SubscriptionsField(),
        'service_usage': ServiceUsageResponse(),
        'account_restricted': serializers.BooleanField(),
        'asset_count': serializers.IntegerField(),
        'active_project_count': serializers.IntegerField(),
    },
)
