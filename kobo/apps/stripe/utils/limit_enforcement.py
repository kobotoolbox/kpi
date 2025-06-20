from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.organizations.constants import UsageType
from kpi.utils.usage_calculator import ServiceUsageCalculator


@requires_stripe
def check_exceeded_limit(user, usage_type: UsageType, **kwargs):
    org = user.organization
    if org.is_mmo:
        user = org.owner_user_object

    cache_key = f'{user.id}_checked_exceeded_{usage_type}_limit'
    print(cache_key)

    if cache.get(cache_key, None):
        return

    ExceededLimitCounter = kwargs['exceeded_limit_counter_model']
    calculator = ServiceUsageCalculator(user, True)
    balances = calculator.get_usage_balances()

    balance = balances[usage_type]
    # import pdb;pdb.set_trace()
    if balance and balance['exceeded']:
        counter, created = ExceededLimitCounter.objects.get_or_create(
            user=user,
            limit_type=usage_type,
            defaults={'days': 1},  # Default value if a new counter is created
        )

        if not created and counter.date_modified.date() < timezone.now().date():
            delta = timezone.now().date() - counter.date_modified.date()
            counter.days += delta.days
            counter.save()

    cache.set(cache_key, True, settings.ENDPOINT_CACHE_DURATION)
