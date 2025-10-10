from typing import Any

from django.utils import timezone
from rest_framework import serializers

from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.subscription_limits import (
    get_organizations_effective_limits,
)
from kobo.apps.user_reports.models import UserReports
from kpi.utils.usage_calculator import (
    calculate_usage_balance,
)


class UserReportsSerializer(serializers.ModelSerializer):
    extra_details__uid = serializers.CharField(
        source='extra_details_uid', read_only=True
    )
    service_usage = serializers.SerializerMethodField()
    account_restricted = serializers.SerializerMethodField()

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
            'service_usage',
            'account_restricted',
            'asset_count',
            'deployed_asset_count',
        ]

    def get_account_restricted(self, obj) -> bool:
        service_usage = obj.service_usage
        balances = service_usage.get('balances', {})
        return any(balance and balance.get('exceeded') for balance in balances.values())

    def get_service_usage(self, obj) -> dict[str, Any]:
        su = obj.service_usage

        # Calculate usage balances (this is the only runtime calculation needed)
        balances = self._calculate_usage_balances(obj)

        # Format billing period dates
        current_period_start = None
        current_period_end = None
        if obj.current_period_start:
            current_period_start = obj.current_period_start.isoformat()
        if obj.current_period_end:
            current_period_end = obj.current_period_end.isoformat()

        su['balances'] = balances
        su['current_period_start'] = current_period_start
        su['current_period_end'] = current_period_end
        su['last_updated'] = timezone.now().isoformat()
        return su

    def _calculate_usage_balances(self, obj) -> dict[str, Any]:
        """
        Calculate usage balances against organization limits.

        This is the only remaining runtime calculation, but it's much more
        efficient since all usage data is pre-computed.
        """
        if not obj.organization_id:
            return {}

        organization = Organization.objects.get(id=obj.organization_id)
        limits = get_organizations_effective_limits([organization], True, True)
        org_limits = limits.get(organization.id, {})

        return {
            'submission': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.SUBMISSION}_limit', float('inf')),
                usage=obj.total_submission_count_current_period,
            ),
            'storage_bytes': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.STORAGE_BYTES}_limit', float('inf')),
                usage=obj.total_storage_bytes,
            ),
            'asr_seconds': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.ASR_SECONDS}_limit', float('inf')),
                usage=obj.total_nlp_usage_asr_seconds_current_period,
            ),
            'mt_characters': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.MT_CHARACTERS}_limit', float('inf')),
                usage=obj.total_nlp_usage_mt_characters_current_period,
            ),
        }
