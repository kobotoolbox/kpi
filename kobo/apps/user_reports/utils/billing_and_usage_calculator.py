from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from kobo.apps.openrosa.apps.logger.models import DailyXFormSubmissionCounter
from kobo.apps.organizations.models import Organization
from kpi.utils.usage_calculator import get_storage_usage_by_user_id
from ..typing_aliases import OrganizationIterator


class BillingAndUsageCalculator:

    def calculate_usage_batch(
        self, organizations: OrganizationIterator, billing_dates: dict
    ) -> dict:
        org_map = {}
        for org in organizations:
            if not (eff_uid := self.get_effective_user_id(org)):
                pass

            org_map[org.id] = {
                'effective_user_id': eff_uid,
                'billing_dates': billing_dates.get(org.id, {}),
            }

        user_ids = [v['effective_user_id'] for v in org_map.values()]
        storage_map = get_storage_usage_by_user_id(user_ids)
        submission_map = self._get_submission_usage_batch(
            user_ids,
            {v['effective_user_id']: v['billing_dates'] for v in org_map.values()},
        )

        result = {}
        for org_id, info in org_map.items():
            uid = info['effective_user_id']
            result[org_id] = {
                'effective_user_id': uid,
                'storage_bytes_total': storage_map.get(uid, 0),
                'submission_counts_all_time': submission_map.get(uid, {}).get(
                    'all_time', 0
                ),
                'current_period_submissions': submission_map.get(uid, {}).get(
                    'current_period', 0
                ),
                'billing_period_start': info['billing_dates'].get('start'),
                'billing_period_end': info['billing_dates'].get('end'),
            }
        return result

    def get_effective_user_id(self, organization: Organization) -> int | None:
        try:
            return organization.owner_user_object.pk
        except AttributeError:
            return None

    def _get_submission_usage_batch(self, user_ids, date_ranges_by_user):
        if not user_ids:
            return {}

        # Get all-time submission counts
        rows = (
            DailyXFormSubmissionCounter.objects.filter(user_id__in=user_ids)
            .values('user_id')
            .annotate(total=Coalesce(Sum('counter'), 0))
        )
        all_time = {r['user_id']: r['total'] for r in rows}

        combined_q = Q()
        for uid, dr in date_ranges_by_user.items():
            if dr.get('start') and dr.get('end'):
                combined_q |= Q(user_id=uid, date__range=[dr['start'], dr['end']])

        current = {}
        if combined_q:
            rows = (
                DailyXFormSubmissionCounter.objects.filter(combined_q)
                .values('user_id')
                .annotate(total=Coalesce(Sum('counter'), 0))
            )
            current = {r['user_id']: r['total'] for r in rows}

        return {
            uid: {
                'all_time': all_time.get(uid, 0),
                'current_period': current.get(uid, 0),
            }
            for uid in user_ids
        }
