from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.models import Charge, Subscription

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.models import PlanAddOn, ExceededLimitCounter
from kobo.apps.stripe.utils.limit_enforcement import update_or_remove_limit_counter
from kpi.utils.usage_calculator import ServiceUsageCalculator


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    PlanAddOn.create_or_update_one_time_add_on(instance)


@receiver(post_save, sender=Subscription)
def clear_usage_cache_and_counters(sender, subscription, created, **kwargs):
    user_id = subscription.metadata.get('kpi_owner_user_id', '')
    if not user_id:
        return

    user = User.objects.filter(id=user_id).first()
    if not user:
        return

    ServiceUsageCalculator(user)._clear_cache()

    counters = ExceededLimitCounter.objects.filter(user=user)
    for counter in counters:
        update_or_remove_limit_counter(counter)

