from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

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

    # We disable usage calculator cache so we can get the most recent
    # usage when this function is called after submissions or NLP
    # actions
    calculator = ServiceUsageCalculator(user, disable_cache=True)
    balances = calculator.get_usage_balances()

    balance = balances[usage_type]
    if balance and balance['exceeded']:
        counter, created = ExceededLimitCounter.objects.get_or_create(
            user=user,
            limit_type=usage_type,
            defaults={'days': 1},
        )

        if not created and counter.date_modified.date() < timezone.now().date():
            delta = timezone.now().date() - counter.date_modified.date()
            counter.days += delta.days
            counter.save()

    cache.set(cache_key, True, settings.ENDPOINT_CACHE_DURATION)


@requires_stripe
def update_or_remove_limit_counter(counter, **kwargs):
    calculator = ServiceUsageCalculator(counter.user)
    balances = calculator.get_usage_balances()
    balance = balances[counter.limit_type]
    if not balance or not balance['exceeded']:
        counter.delete()

    if counter.date_modified.date() < timezone.now().date():
        delta = timezone.now().date() - counter.date_modified.date()
        counter.days += delta.days
        counter.save()
