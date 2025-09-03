from collections import defaultdict
from typing import Any, Dict, List

from django.utils import timezone
from rest_framework import serializers

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.stripe.utils.subscription_limits import (
    get_organizations_effective_limits
)
from kpi.models.user_reports import UserReports
from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.log import logging
from kpi.utils.object_permission import get_database_user
from kpi.utils.permissions import is_user_anonymous
from kpi.utils.usage_calculator import (
    calculate_usage_balance,
    get_nlp_usage_in_date_range_by_user_id,
    get_submission_counts_in_date_range_by_user_id,
)


class OptimizedBillingPeriodCalculator:
    """
    Optimized calculator for billing period usage data across multiple users.
    Uses batch queries instead of individual `ServiceUsageCalculator` instances.
    """
    def get_billing_period_usage_batch(
        self, user_objects: List[UserReports]
    ) -> Dict[str, Dict]:
        """
        Calculate billing period usage for multiple users efficiently.
        Returns dict with username as key and usage data as value.
        """
        try:
            # Step 1: Group users by organization and get billing periods
            org_users_map = self._group_users_by_organization(user_objects)

            # Step 2: Get billing dates for all organizations
            org_billing_dates = self._get_billing_dates_batch(
                list(org_users_map.keys())
            )

            # Step 3: Calculate current period usage in batches
            usage_data = {}
            for org_id, users_info in org_users_map.items():
                billing_dates = org_billing_dates.get(org_id)
                if not billing_dates:
                    # Use default dates if no billing period found
                    now = timezone.now()
                    billing_dates = {
                        'start': now.replace(day=1),
                        'end': (
                            now.replace(day=1) + timezone.timedelta(days=32)
                        ).replace(day=1)
                    }

                # Get user IDs for this organization
                user_ids = [info['user_id'] for info in users_info]

                # Calculate submissions for current billing period
                submission_usage = self._get_submissions_for_period(
                    user_ids, billing_dates['start'], billing_dates['end']
                )

                # Calculate NLP usage for current billing period
                nlp_usage = self._get_nlp_usage_for_period(
                    user_ids, billing_dates['start'], billing_dates['end']
                )

                # Build usage data for each user in this organization
                for user_info in users_info:
                    username = user_info['username']
                    user_id = user_info['user_id']

                    usage_data[username] = {
                        'billing_period': billing_dates,
                        'current_period_submissions': submission_usage.get(user_id, 0),
                        'current_period_asr':
                            nlp_usage.get(user_id, {}).get(UsageType.ASR_SECONDS, 0),
                        'current_period_mt':
                            nlp_usage.get(user_id, {}).get(UsageType.MT_CHARACTERS, 0),
                        'organization_id': org_id
                    }

            return usage_data

        except Exception as e:
            logging.error(f'Error in batch billing period calculation: {e}')
            return {}

    def _group_users_by_organization(
        self, user_objects: List[UserReports]
    ) -> Dict[int, List[Dict]]:
        """
        Group users by their organization ID
        """
        org_users_map = defaultdict(list)

        # Get user and organization data in batch
        usernames = [obj.username for obj in user_objects]
        users_data = User.objects.select_related('organization').filter(
            username__in=usernames
        ).values('id', 'username', 'organization_id')

        user_lookup = {user['username']: user for user in users_data}

        for obj in user_objects:
            user_data = user_lookup.get(obj.username)
            if user_data and user_data['organization_id']:
                org_users_map[user_data['organization_id']].append({
                    'username': obj.username,
                    'user_id': user_data['id'],
                    'user_obj': obj
                })

        return dict(org_users_map)

    def _get_billing_dates_batch(self, org_ids: List[int]) -> Dict[int, Dict]:
        """
        Get billing dates for multiple organizations efficiently
        """
        organizations = Organization.objects.filter(id__in=org_ids)
        return get_current_billing_period_dates_by_org(list(organizations))

    def _get_submissions_for_period(
        self, user_ids: List[int], start_date, end_date
    ) -> Dict[int, int]:
        """
        Get submission counts for users in date range
        """
        date_ranges_by_user = {
            user_id: {'start': start_date, 'end': end_date}
            for user_id in user_ids
        }
        return get_submission_counts_in_date_range_by_user_id(date_ranges_by_user)

    def _get_nlp_usage_for_period(
        self, user_ids: List[int], start_date, end_date
    ) -> Dict[int, Dict]:
        """
        Get NLP usage for users in date range
        """
        date_ranges_by_user = {
            user_id: {'start': start_date, 'end': end_date}
            for user_id in user_ids
        }
        return get_nlp_usage_in_date_range_by_user_id(date_ranges_by_user)


class OptimizedUserReportSerializer(serializers.ModelSerializer):
    """
    Enhanced serializer with optimized `current_service_usage` calculations.
    Uses batch processing for billing period calculations to improve performance.
    """
    extra_details__uid = serializers.CharField(
        source='extra_details_uid', read_only=True
    )
    current_service_usage = serializers.SerializerMethodField()
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = UserReports
        fields = [
            'extra_details__uid', 'username', 'first_name', 'last_name',
            'email', 'is_superuser', 'is_staff', 'is_active',
            'date_joined', 'last_login', 'validated_email', 'validated_password',
            'mfa_is_active', 'sso_is_active', 'accepted_tos',
            'social_accounts', 'organizations', 'metadata', 'subscriptions',
            'current_service_usage', 'asset_count', 'deployed_asset_count'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._usage_cache = {}

    def to_representation(self, instance):
        """
        Override to enable batch processing when serializing multiple objects
        """
        if hasattr(self.parent, 'instance') and hasattr(
            self.parent.instance, '__iter__'
        ):
            if not self._usage_cache:
                # First time calculate usage for all objects in batch
                self._calculate_batch_usage()

        return super().to_representation(instance)

    def _calculate_batch_usage(self):
        """
        Calculate usage data for all objects in batch
        """
        if not hasattr(self.parent, 'instance'):
            return

        # Get all user objects from parent
        user_objects = list(self.parent.instance)
        if not user_objects:
            return

        # Use optimized batch calculator
        calculator = OptimizedBillingPeriodCalculator()
        self._usage_cache = calculator.get_billing_period_usage_batch(user_objects)

    def get_organizations(self, obj) -> Dict[str, Any] | None:
        org_data = obj.organizations
        if org_data:
            # ToDo: Add user role
            return org_data
        return None

    def get_current_service_usage(self, obj) -> Dict[str, Any]:
        """
        Generate `current_service_usage` data using optimized batch calculations
        or fallback to individual calculation if batch failed.
        """
        # Try to get from cache first (batch calculation)
        cached_usage = self._usage_cache.get(obj.username)

        if cached_usage:
            return self._build_service_usage_response(obj, cached_usage)

        # Fallback to individual calculation
        return self._calculate_individual_service_usage(obj)

    def _build_service_usage_response(self, obj, usage_data) -> Dict[str, Any]:
        """
        Build the service usage response from calculated usage data
        """
        billing_period = usage_data['billing_period']

        # Build total_nlp_usage structure
        total_nlp_usage = {
            'asr_seconds_current_period': usage_data['current_period_asr'],
            'mt_characters_current_period': usage_data['current_period_mt'],
            'asr_seconds_all_time': obj.nlp_usage_asr_seconds_total,
            'mt_characters_all_time': obj.nlp_usage_mt_characters_total
        }

        # Build total_submission_count structure
        total_submission_count = {
            'current_period': usage_data['current_period_submissions'],
            'all_time': obj.submission_counts_all_time
        }

        # Calculate balances
        balances = self._calculate_balances_for_org(
            usage_data['organization_id'],
            usage_data['current_period_submissions'],
            obj.storage_bytes_total,
            usage_data['current_period_asr'],
            usage_data['current_period_mt']
        )

        return {
            'total_nlp_usage': total_nlp_usage,
            'total_storage_bytes': obj.storage_bytes_total,
            'total_submission_count': total_submission_count,
            'balances': balances,
            'current_period_start': billing_period['start'].isoformat(),
            'current_period_end': billing_period['end'].isoformat(),
            'last_updated': timezone.now().isoformat()
        }

    def _calculate_individual_service_usage(self, obj) -> Dict[str, Any]:
        """
        Fallback to individual calculation using `ServiceUsageSerializer`
        """
        user = User.objects.get(username=obj.username)
        if is_user_anonymous(user):
            return None

        serializer = ServiceUsageSerializer(
            instance=get_database_user(user), context=self.context
        )
        return serializer.data

    def _calculate_balances_for_org(
        self, org_id: int, submissions: int, storage: int, asr_usage: int, mt_usage: int
    ) -> Dict[str, Any]:
        """
        Calculate usage balances against limits for a specific organization
        """
        organization = Organization.objects.get(id=org_id)

        # Get effective limits for the organization
        limits = get_organizations_effective_limits(
            [organization], True, True
        )
        org_limits = limits.get(organization.id, {})

        return {
            'submission': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.SUBMISSION}_limit', float('inf')),
                usage=submissions
            ),
            'storage_bytes': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.STORAGE_BYTES}_limit', float('inf')),
                usage=storage
            ),
            'asr_seconds': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.ASR_SECONDS}_limit', float('inf')),
                usage=asr_usage
            ),
            'mt_characters': calculate_usage_balance(
                limit=org_limits.get(f'{UsageType.MT_CHARACTERS}_limit', float('inf')),
                usage=mt_usage
            )
        }
