from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django_request_cache import cache_for_request

from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kpi.utils.usage_calculator import ServiceUsageCalculator


@requires_stripe
def check_exceeded_limit(user, usage_type: UsageType, **kwargs):
    """
    Checks whether user's org has exceeded its limits for a given
    usage type and updates ExceededLimitCounters accordingly. Uses
    cached key to avoid running checks more than once within
    the ENDPOINT_CACHE_DURATION
    """
    org = user.organization
    if org.is_mmo:
        user = org.owner_user_object

    cache_key = f'{user.id}_checked_exceeded_{usage_type}_limit'

    if cache.get(cache_key, None):
        return

    ExceededLimitCounter = kwargs['exceeded_limit_counter_model']
    balances = _get_usage_balances(user)
    balance = balances[usage_type]
    counter = None

    if balance and balance['exceeded']:
        counter, created = ExceededLimitCounter.objects.get_or_create(
            user=user,
            limit_type=usage_type,
        )

        if not created and counter.date_modified.date() < timezone.now().date():
            delta = timezone.now().date() - counter.date_modified.date()
            counter.days += delta.days
            counter.save()

    cache.set(cache_key, True, settings.ENDPOINT_CACHE_DURATION)
    return counter


@requires_stripe
def update_or_remove_limit_counter(counter, **kwargs):
    calculator = ServiceUsageCalculator(counter.user)
    balances = calculator.get_usage_balances()
    balance = balances[counter.limit_type]
    if not balance or not balance['exceeded']:
        counter.delete()
        return

    if counter.date_modified <= timezone.now() - timedelta(hours=24):
        delta = timezone.now() - counter.date_modified
        counter.days += delta.days
        counter.save()


@cache_for_request
def _get_usage_balances(user: 'kobo_auth.User') -> dict:
    """
    Cache the result of `get_usage_balances` for the duration of the request.

    This avoids redundant recalculations when `check_exceeded_limit` is called
    multiple times within the same request for different usage types.

    Since ServiceUsageCalculator caching is disabled to ensure the most up-to-date
    values after submissions or NLP actions, the first call already computes all usage
    types, so subsequent calls can safely reuse the cached result.
    """

    calculator = ServiceUsageCalculator(user, disable_cache=True)
    return calculator.get_usage_balances()
