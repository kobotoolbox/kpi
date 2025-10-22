from rest_framework import serializers

from kpi.schema_extensions.v2.me.fields import SocialAccountField
from kpi.schema_extensions.v2.service_usage.serializers import ServiceUsageResponse
from kpi.schema_extensions.v2.user_reports.fields import (
    OrganizationsField,
    SubscriptionsField,
)
from kpi.schema_extensions.v2.users.fields import MetadataField
from kpi.utils.schema_extensions.serializers import inline_serializer_class

UserReportsListResponse = inline_serializer_class(
    name='UserReportsListResponse',
    fields={
        'extra_details_uid': serializers.CharField(),
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
        'validated_password': serializers.BooleanField(),
        'mfa_is_active': serializers.BooleanField(),
        'sso_is_active': serializers.BooleanField(),
        'accepted_tos': serializers.BooleanField(),
        'social_accounts': SocialAccountField(),
        'organizations': OrganizationsField(),
        'metadata': MetadataField(),
        'subscriptions': SubscriptionsField(),
        'current_service_usage': ServiceUsageResponse(),
        'account_restricted': serializers.BooleanField(),
        'asset_count': serializers.IntegerField(),
        'deployed_asset_count': serializers.IntegerField(),
    },
)
