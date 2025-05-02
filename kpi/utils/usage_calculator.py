from json import dumps, loads

from django.apps import apps
from django.conf import settings
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import DailyXFormSubmissionCounter, XForm
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import NLPUsage
from kobo.apps.organizations.utils import get_billing_dates
from kobo.apps.stripe.utils import (
    get_current_billing_period_dates_by_org,
    requires_stripe,
)
from kpi.utils.cache import CachedClass, cached_class_property


def get_storage_usage_by_user_id(user_ids: list[int] = None) -> dict[int, int]:
    xforms = XForm.objects.exclude(pending_delete=True)
    if user_ids is not None:
        xforms = xforms.filter(user_id__in=user_ids)
    xform_query = xforms.values('user').annotate(
        bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0)
    )
    return {res['user']: res['bytes_sum'] for res in xform_query}


def get_submission_counts_in_date_range_by_user_id(
    date_ranges_by_user,
) -> dict[int, int]:
    filters = Q()
    for user_id, date_range in date_ranges_by_user.items():
        filters |= Q(
            user_id=user_id, date__range=[date_range['start'], date_range['end']]
        )
    all_sub_counters = (
        DailyXFormSubmissionCounter.objects.values('counter', 'user_id', 'date')
        .filter(filters)
        .annotate(total=Sum('counter'))
    )
    return {row['user_id']: row['total'] for row in all_sub_counters}


@requires_stripe
def get_submissions_for_current_billing_period_by_user_id(**kwargs) -> dict[int, int]:
    current_billing_dates_by_org = get_current_billing_period_dates_by_org()
    owner_by_org = {
        org_vals['id']: org_vals['owner__organization_user__user__id']
        for org_vals in Organization.objects.values(
            'id', 'owner__organization_user__user__id'
        ).filter(owner__isnull=False)
    }
    current_billing_dates_by_owner = {
        owner_by_org[org_id]: dates
        for org_id, dates in current_billing_dates_by_org.items()
        if org_id in owner_by_org
    }
    return get_submission_counts_in_date_range_by_user_id(
        current_billing_dates_by_owner
    )


def get_nlp_usage_in_date_range_by_user_id(date_ranges_by_user) -> dict[int, NLPUsage]:
    filters = Q()
    for user_id, date_range in date_ranges_by_user.items():
        filters |= Q(
            user_id=user_id, date__range=[date_range['start'], date_range['end']]
        )
    NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')  # noqa

    nlp_tracking = (
        NLPUsageCounter.objects.values('user_id')
        .filter(filters)
        .annotate(
            asr_seconds_current_period=Coalesce(
                Sum('total_asr_seconds'),
                0,
            ),
            mt_characters_current_period=Coalesce(
                Sum('total_mt_characters'),
                0,
            ),
        )
    )
    results = {}
    for row in nlp_tracking:
        results[row['user_id']] = {
            'seconds': row['asr_seconds_current_period'],
            'characters': row['mt_characters_current_period'],
        }
    return results


@requires_stripe
def get_nlp_usage_for_current_billing_period_by_user_id(
    **kwargs,
) -> dict[int, NLPUsage]:
    current_billing_dates_by_org = get_current_billing_period_dates_by_org()
    owner_by_org = {
        org_vals['id']: org_vals['owner__organization_user__user__id']
        for org_vals in Organization.objects.values(
            'id', 'owner__organization_user__user__id'
        ).filter(owner__isnull=False)
    }
    current_billing_dates_by_owner = {
        owner_by_org[org_id]: dates
        for org_id, dates in current_billing_dates_by_org.items()
        if org_id in owner_by_org
    }
    return get_nlp_usage_in_date_range_by_user_id(current_billing_dates_by_owner)


class ServiceUsageCalculator(CachedClass):
    CACHE_TTL = settings.ENDPOINT_CACHE_DURATION

    def __init__(
        self,
        user: User,
        disable_cache: bool = False,
    ):
        self.user = user
        self._cache_available = not disable_cache
        self._user_id = user.pk
        self.organization = user.organization
        if self.organization.is_mmo:
            self._user_id = self.organization.owner_user_object.pk

        now = timezone.now()
        self.current_period_start, self.current_period_end = get_billing_dates(
            self.organization
        )
        self.current_period_filter = Q(date__range=[self.current_period_start, now])
        self._setup_cache()

    def get_nlp_usage_by_type(self, usage_key: str) -> int:
        """Returns the usage for a given organization and usage key. The usage key
        should be the value from the USAGE_LIMIT_MAP found in the stripe kobo app.
        """
        nlp_usage = self.get_nlp_usage_counters()

        cached_usage = {
            'asr_seconds': nlp_usage['asr_seconds_current_period'],
            'mt_characters': nlp_usage['mt_characters_current_period'],
        }

        return cached_usage[usage_key]

    def get_last_updated(self):
        return self._cache_last_updated()

    @cached_class_property(
        key='nlp_usage_counters', serializer=dumps, deserializer=loads
    )
    def get_nlp_usage_counters(self):
        NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')  # noqa

        nlp_tracking = (
            NLPUsageCounter.objects.only(
                'date', 'total_asr_seconds', 'total_mt_characters'
            )
            .filter(user_id=self._user_id)
            .aggregate(
                asr_seconds_current_period=Coalesce(
                    Sum('total_asr_seconds', filter=self.current_period_filter),
                    0,
                ),
                mt_characters_current_period=Coalesce(
                    Sum('total_mt_characters', filter=self.current_period_filter),
                    0,
                ),
                asr_seconds_all_time=Coalesce(Sum('total_asr_seconds'), 0),
                mt_characters_all_time=Coalesce(Sum('total_mt_characters'), 0),
            )
        )

        total_nlp_usage = {}
        for nlp_key, count in nlp_tracking.items():
            total_nlp_usage[nlp_key] = count if count is not None else 0

        return total_nlp_usage

    @cached_class_property(key='storage_usage', serializer=str, deserializer=int)
    def get_storage_usage(self):
        """
        Get the storage used by non-(soft-)deleted projects for all users

        Users are represented by their ids with `self._user_ids`
        """
        return get_storage_usage_by_user_id([self._user_id]).get(self._user_id, 0)

    @cached_class_property(
        key='submission_counters', serializer=dumps, deserializer=loads
    )
    def get_submission_counters(self):
        """
        Calculate submissions for all users' projects even their deleted ones

        Users are represented by their ids with `self._user_ids`
        """
        submission_count = (
            DailyXFormSubmissionCounter.objects.only('counter', 'user_id')
            .filter(user_id=self._user_id)
            .aggregate(
                all_time=Coalesce(Sum('counter'), 0),
                current_period=Coalesce(
                    Sum('counter', filter=self.current_period_filter), 0
                ),
            )
        )

        total_submission_count = {}
        for submission_key, count in submission_count.items():
            total_submission_count[submission_key] = count if count is not None else 0

        return total_submission_count

    def _get_cache_hash(self):
        if self.organization is None:
            return f'user-{self.user.id}'
        else:
            return f'organization-{self.organization.id}'
