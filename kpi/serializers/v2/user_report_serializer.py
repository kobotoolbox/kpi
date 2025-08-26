from rest_framework import serializers
from django.conf import settings
from django.apps import apps
from math import inf
from typing import Dict, List, Tuple

from kpi.models.user_report import UserReportMaterialized
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.stripe.utils.subscription_limits import get_organizations_effective_limits
from kobo.apps.organizations.models import Organization
from kpi.utils.optimized_usage_calculator import OptimizedUsageCalculator


class UserReportSerializer(serializers.ModelSerializer):
    """
    Serializer for the hybrid materialized view approach.
    Pre-computed data from materialized view + on-demand current period calculations.
    """

    extra_details__uid = serializers.CharField(source='extra_details_uid')
    organizations = serializers.SerializerMethodField()
    current_service_usage = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.usage_calculator = OptimizedUsageCalculator()
        self._current_period_cache = {}

    class Meta:
        model = UserReportMaterialized
        fields = (
            'extra_details__uid',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_superuser',
            'is_staff',
            'is_active',
            'date_joined',
            'last_login',
            'validated_email',
            'validated_password',
            'mfa_is_active',
            'sso_is_active',
            'accepted_tos',
            'social_accounts',
            'organizations',
            'metadata',
            'subscriptions',
            'current_service_usage',
            'asset_count',
            'deployed_asset_count',
        )

    def to_representation(self, instance):
        current_period_data = self.usage_calculator.calculate_single_user_current_period(
            instance.user_id, instance.organization_id
        )
        self._current_period_cache[instance.user_id] = current_period_data
        return super().to_representation(instance)

    def get_organizations(self, obj):
        if obj.organization_id is None:
            return None

        role = 'owner' if obj.is_org_admin else 'member'

        return {
            'organization_name': obj.organization_name,
            'organization_uid': obj.organization_uid,
            'role': role,
        }

    def get_current_service_usage(self, obj):
        current_period_data = self._current_period_cache.get(obj.user_id, {})

        total_nlp_usage = {
            'asr_seconds_current_period': current_period_data.get('nlp_usage_asr_seconds_total', 0),
            'mt_characters_current_period': current_period_data.get('nlp_usage_mt_characters_total', 0),
            'asr_seconds_all_time': obj.nlp_usage_asr_seconds_all_time,
            'mt_characters_all_time': obj.nlp_usage_mt_characters_all_time,
        }

        total_submission_count = {
            'all_time': obj.submission_counts_all_time,
            'current_period': current_period_data.get('submission_counts_current_month', 0),
        }

        # balances = self._calculate_balances(obj, current_period_data)

        return {
            'total_nlp_usage': total_nlp_usage,
            'total_storage_bytes': obj.total_storage_bytes,
            'total_submission_count': total_submission_count,
            'balances': [],
            'current_period_start': current_period_data.get(
                'current_period_start').isoformat() if current_period_data.get('current_period_start') else None,
            'current_period_end': current_period_data.get('current_period_end').isoformat() if current_period_data.get(
                'current_period_end') else None,
            'last_updated': obj.last_refresh.isoformat() if obj.last_refresh else None,
        }

    def _calculate_balances(self, obj, current_period_data: Dict):
        # balances = {
        #     "submission": calculate_usage_balance(
        #         limit=org_limits.get(f"{UsageType.SUBMISSION}_limit", float("inf")),
        #         usage=submissions_cur,
        #     ),
        #     "storage_bytes": calculate_usage_balance(
        #         limit=org_limits.get(f"{UsageType.STORAGE_BYTES}_limit", float("inf")),
        #         usage=storage_total,
        #     ),
        #     "asr_seconds": calculate_usage_balance(
        #         limit=org_limits.get(f"{UsageType.ASR_SECONDS}_limit", float("inf")),
        #         usage=asr_cur,
        #     ),
        #     "mt_characters": calculate_usage_balance(
        #         limit=org_limits.get(f"{UsageType.MT_CHARACTERS}_limit", float("inf")),
        #         usage=mt_cur,
        #     ),
        # }

        return {}


class UserReportFilterSerializer(serializers.Serializer):
    subscriptions = serializers.CharField(required=False, help_text="Filter by subscription status/type")
    storage_bytes__total = serializers.IntegerField(required=False, help_text="Filter by total storage bytes")
    nlp_usage__asr_seconds_total = serializers.IntegerField(required=False, help_text="Filter by ASR seconds total")
    nlp_usage__mt_characters_total = serializers.IntegerField(required=False, help_text="Filter by MT characters total")
    date_joined = serializers.DateTimeField(required=False, help_text="Filter by date joined")
    last_login = serializers.DateTimeField(required=False, help_text="Filter by last login")
    metadata__organization_type = serializers.CharField(required=False, help_text="Filter by organization type")
    subscription_id = serializers.CharField(required=False, help_text="Filter by specific subscription ID")
    email = serializers.CharField(required=False, help_text="Filter by email address")

    storage_bytes__total__gte = serializers.IntegerField(required=False,
                                                         help_text="Storage bytes greater than or equal")
    storage_bytes__total__lte = serializers.IntegerField(required=False, help_text="Storage bytes less than or equal")
    date_joined__gte = serializers.DateTimeField(required=False, help_text="Date joined after")
    date_joined__lte = serializers.DateTimeField(required=False, help_text="Date joined before")
    last_login__gte = serializers.DateTimeField(required=False, help_text="Last login after")
    last_login__lte = serializers.DateTimeField(required=False, help_text="Last login before")
