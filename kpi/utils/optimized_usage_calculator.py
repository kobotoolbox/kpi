from django.apps import apps
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from typing import Dict, List, Tuple
from collections import defaultdict

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.utils import get_billing_dates
from kobo.apps.organizations.constants import UsageType


class OptimizedUsageCalculator:
    """
    Efficiently calculates current period usage for multiple users at once.
    Minimizes database queries by batching operations per organization.
    """

    def __init__(self):
        self.DailyCounter = apps.get_model('logger', 'DailyXFormSubmissionCounter')
        self.NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')

    def calculate_current_period_usage_batch(
        self,
        user_org_pairs: List[Tuple[int, int]]
    ) -> Dict[int, Dict]:
        """
        Calculate current period usage for multiple users efficiently.

        Args:
            user_org_pairs: List of (user_id, organization_id) tuples

        Returns:
            Dict mapping user_id to their current period usage data
        """
        if not user_org_pairs:
            return {}

        # Group users by organization for efficient billing period lookup
        users_by_org = defaultdict(list)
        for user_id, org_id in user_org_pairs:
            if org_id:  # Only group users that have organizations
                users_by_org[org_id].append(user_id)

        # Get billing periods for all organizations at once
        org_billing_periods = self._get_billing_periods_batch(
            list(users_by_org.keys())
        )

        # Calculate current period usage efficiently
        submissions_data = self._get_current_period_submissions_batch(
            users_by_org, org_billing_periods
        )
        nlp_data = self._get_current_period_nlp_batch(users_by_org, org_billing_periods)

        # Combine results
        result = {}
        for user_id, org_id in user_org_pairs:
            result[user_id] = {
                'submission_counts_current_month': submissions_data.get(user_id, 0),
                'nlp_usage_asr_seconds_total': nlp_data.get(user_id, {}).get('asr_seconds', 0),
                'nlp_usage_mt_characters_total': nlp_data.get(user_id, {}).get('mt_characters', 0),
                'current_period_start': org_billing_periods.get(org_id, {}).get('start'),
                'current_period_end': org_billing_periods.get(org_id, {}).get('end'),
            }

        return result

    def _get_billing_periods_batch(self, org_ids: List[int]) -> Dict[int, Dict]:
        """
        Get billing periods for multiple organizations efficiently.
        """
        if not org_ids:
            return {}

        # Fetch organizations in a single query
        orgs = Organization.objects.filter(id__in=org_ids).select_related()

        billing_periods = {}
        for org in orgs:
            try:
                start, end = get_billing_dates(org)
                billing_periods[org.id] = {
                    'start': start,
                    'end': end
                }
            except Exception:
                # Fallback to current month if billing dates fail
                now = timezone.now()
                billing_periods[org.id] = {
                    'start': now.replace(
                        day=1, hour=0, minute=0, second=0, microsecond=0
                    ),
                    'end': now
                }

        return billing_periods

    def _get_current_period_submissions_batch(
        self,
        users_by_org: Dict[int, List[int]],
        org_billing_periods: Dict[int, Dict]
    ) -> Dict[int, int]:
        """
        Get current period submissions for multiple users efficiently.
        """
        if not users_by_org or not org_billing_periods:
            return {}

        # Build efficient query with OR conditions for each org's billing period
        filters = Q()
        for org_id, user_ids in users_by_org.items():
            billing_period = org_billing_periods.get(org_id)
            if billing_period and user_ids:
                filters |= Q(
                    user_id__in=user_ids,
                    date__range=[billing_period['start'], billing_period['end']]
                )

        if not filters:
            return {}

        # Execute single query for all users
        submission_data = (
            self.DailyCounter.objects
            .filter(filters)
            .values('user_id')
            .annotate(current_period_total=Sum('counter'))
        )

        return {
            row['user_id']: row['current_period_total'] or 0
            for row in submission_data
        }

    def _get_current_period_nlp_batch(
        self,
        users_by_org: Dict[int, List[int]],
        org_billing_periods: Dict[int, Dict]
    ) -> Dict[int, Dict]:
        """
        Get current period NLP usage for multiple users efficiently.
        """
        if not users_by_org or not org_billing_periods:
            return {}

        # Build efficient query with OR conditions for each org's billing period
        filters = Q()
        for org_id, user_ids in users_by_org.items():
            billing_period = org_billing_periods.get(org_id)
            if billing_period and user_ids:
                filters |= Q(
                    user_id__in=user_ids,
                    date__range=[billing_period['start'], billing_period['end']]
                )

        if not filters:
            return {}

        # Execute single query for all users
        nlp_data = (
            self.NLPUsageCounter.objects
            .filter(filters)
            .values('user_id')
            .annotate(
                asr_seconds_total=Coalesce(
                    Sum(f'total_{UsageType.ASR_SECONDS}'), 0
                ),
                mt_characters_total=Coalesce(
                    Sum(f'total_{UsageType.MT_CHARACTERS}'), 0
                )
            )
        )

        return {
            row['user_id']: {
                'asr_seconds': row['asr_seconds_total'],
                'mt_characters': row['mt_characters_total']
            }
            for row in nlp_data
        }

    def calculate_single_user_current_period(
        self, user_id: int, organization_id: int
    ) -> Dict:
        """
        Calculate current period usage for a single user (fallback method).
        """
        if not organization_id:
            return {
                'submission_counts_current_month': 0,
                'nlp_usage_asr_seconds_total': 0,
                'nlp_usage_mt_characters_total': 0,
                'current_period_start': None,
                'current_period_end': None,
            }

        return self.calculate_current_period_usage_batch(
            [(user_id, organization_id)]
        ).get(user_id, {})
