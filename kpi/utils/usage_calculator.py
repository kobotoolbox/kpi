from json import dumps, loads

from django.apps import apps
from django.conf import settings
from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import DailyXFormSubmissionCounter, XForm
from kobo.apps.organizations.utils import get_billing_dates
from kpi.utils.cache import CachedClass, cached_class_property


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
        xforms = (
            XForm.objects.only('attachment_storage_bytes', 'id')
            .exclude(pending_delete=True)
            .filter(user_id=self._user_id)
        )

        total_storage_bytes = xforms.aggregate(
            bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0),
        )

        return total_storage_bytes['bytes_sum'] or 0

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
