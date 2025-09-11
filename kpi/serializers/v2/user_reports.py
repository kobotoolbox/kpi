from typing import Any, Dict

from django.utils import timezone
from rest_framework import serializers

from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.subscription_limits import (
    get_organizations_effective_limits
)
from kpi.models.user_reports import UserReports
from kpi.utils.usage_calculator import (
    calculate_usage_balance,
)


class UserReportsSerializer(serializers.ModelSerializer):
    extra_details__uid = serializers.CharField(
        source='extra_details_uid', read_only=True
    )
    current_service_usage = serializers.SerializerMethodField()

    class Meta:
        model = UserReports
        fields = [
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
            'deployed_asset_count'
        ]

    def get_current_service_usage(self, obj) -> Dict[str, Any]:
        total_nlp_usage = {
            'asr_seconds_current_period': obj.current_period_asr,
            'mt_characters_current_period': obj.current_period_mt,
            'asr_seconds_all_time': obj.nlp_usage_asr_seconds_total,
            'mt_characters_all_time': obj.nlp_usage_mt_characters_total
        }

        total_submission_count = {
            'current_period': obj.current_period_submissions,
            'all_time': obj.submission_counts_all_time
        }

        # Calculate usage balances (this is the only runtime calculation needed)
        balances = self._calculate_usage_balances(obj)

        # Format billing period dates
        current_period_start = None
        current_period_end = None
        if obj.current_period_start:
            current_period_start = obj.current_period_start.isoformat()
        if obj.current_period_end:
            current_period_end = obj.current_period_end.isoformat()

        return {
            'total_nlp_usage': total_nlp_usage,
            'total_storage_bytes': obj.storage_bytes_total,
            'total_submission_count': total_submission_count,
            'balances': balances,
            'current_period_start': current_period_start,
            'current_period_end': current_period_end,
            'last_updated': timezone.now().isoformat()
        }

    def _calculate_usage_balances(self, obj) -> Dict[str, Any]:
        """
        Calculate usage balances against organization limits.

        This is the only remaining runtime calculation, but it's much more
        efficient since all usage data is pre-computed.
        """
        if not obj.organization_id:
            return None

        organization = Organization.objects.get(id=obj.organization_id)
        limits = get_organizations_effective_limits([organization], True, True)
        org_limits = limits.get(organization.id, {})

        return {
            'submission': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.SUBMISSION}_limit', float('inf')),
                usage=obj.current_period_submissions
            ),
            'storage_bytes': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.STORAGE_BYTES}_limit', float('inf')),
                usage=obj.storage_bytes_total
            ),
            'asr_seconds': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.ASR_SECONDS}_limit', float('inf')),
                usage=obj.current_period_asr
            ),
            'mt_characters': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.MT_CHARACTERS}_limit', float('inf')),
                usage=obj.current_period_mt
            ),
        }
