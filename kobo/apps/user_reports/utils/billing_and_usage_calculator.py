from collections import defaultdict
from datetime import datetime

from django.db.models import Sum
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
                'total_storage_bytes': storage_map.get(uid, 0),
                'total_submission_count_all_time': submission_map.get(uid, {}).get(
                    'all_time', 0
                ),
                'total_submission_count_current_period': submission_map.get(
                    uid, {}
                ).get('current_period', 0),
                'billing_period_start': info['billing_dates'].get('start'),
                'billing_period_end': info['billing_dates'].get('end'),
            }
        return result

    def get_effective_user_id(self, organization: Organization) -> int | None:
        try:
            return organization.owner_user_object.pk
        except AttributeError:
            return None

    @staticmethod
    def _as_date(value):
        # Billing bounds are tz-aware datetimes; `date` is a DateField, so
        # normalize to a date for the Python-side window comparison below.
        return value.date() if isinstance(value, datetime) else value

    def _get_submission_usage_batch(self, user_ids, date_ranges_by_user):
        if not user_ids:
            return {}

        # Get all-time submission counts.
        # Note that records in `DailyXFormSubmissionCounter` are deleted after a
        # certain period based on the `DAILY_COUNTERS_MAX_DAYS` setting
        # (default: 366 days, ~12 months). Therefore, this "all-time" value is not
        # truly all-time, but instead reflects data within the retention period.
        rows = (
            DailyXFormSubmissionCounter.objects.filter(user_id__in=user_ids)
            .values('user_id')
            .annotate(total=Coalesce(Sum('counter'), 0))
        )
        all_time = {r['user_id']: r['total'] for r in rows}

        # Get current-period submission counts. Each user has its own billing
        # window. OR-ing one `(user_id=X AND date BETWEEN start AND end)` clause
        # per user forced the planner into a bitmap-or of one index scan per
        # clause, each holding its own work_mem-sized state (the DB-server OOM
        # seen on EU, DEV-2567). Group users by their distinct window instead and
        # run one narrow query per window: ~90% of orgs share the default monthly
        # window and windows key on day-of-month, so a chunk has only a few dozen
        # distinct windows. Each query stays date-range-narrow (one annual plan
        # can't widen the scan for the whole chunk) and aggregates in SQL,
        # returning one row per user.
        windows = defaultdict(list)
        for uid, dr in date_ranges_by_user.items():
            if dr.get('start') and dr.get('end'):
                key = (self._as_date(dr['start']), self._as_date(dr['end']))
                windows[key].append(uid)

        current = {}
        for (start, end), uids in windows.items():
            rows = (
                DailyXFormSubmissionCounter.objects.filter(
                    user_id__in=uids, date__range=[start, end]
                )
                .values('user_id')
                .annotate(total=Coalesce(Sum('counter'), 0))
            )
            for row in rows:
                current[row['user_id']] = row['total']

        return {
            uid: {
                'all_time': all_time.get(uid, 0),
                'current_period': current.get(uid, 0),
            }
            for uid in user_ids
        }
