from typing import Any

from rest_framework import serializers

from kobo.apps.user_reports.models import UserReports


class UserReportsSerializer(serializers.ModelSerializer):
    service_usage = serializers.SerializerMethodField()
    account_restricted = serializers.SerializerMethodField()

    class Meta:
        model = UserReports
        fields = [
            'user_uid',
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
            'mfa_is_active',
            'sso_is_active',
            'accepted_tos',
            'social_accounts',
            'organization',
            'extra_details',
            'subscriptions',
            'service_usage',
            'account_restricted',
            'asset_count',
            'active_project_count',
            'last_updated',
        ]

    def get_account_restricted(self, obj) -> bool:
        service_usage = obj.service_usage
        balances = service_usage.get('balances', {})
        return any(balance and balance.get('exceeded') for balance in balances.values())

    def get_service_usage(self, obj) -> dict[str, Any]:
        su = obj.service_usage

        # Format billing period dates
        current_period_start = None
        current_period_end = None
        if obj.current_period_start:
            current_period_start = obj.current_period_start.isoformat()
        if obj.current_period_end:
            current_period_end = obj.current_period_end.isoformat()

        su['current_period_start'] = current_period_start
        su['current_period_end'] = current_period_end
        return su
