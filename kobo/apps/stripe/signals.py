from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.event_handlers import djstripe_receiver
from djstripe.models import Charge, Product, Subscription

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.models import ExceededLimitCounter, PlanAddOn
from kobo.apps.stripe.utils.limit_enforcement import update_or_remove_limit_counter
from kpi.utils.usage_calculator import ServiceUsageCalculator


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    PlanAddOn.create_or_update_one_time_add_on(instance)


@receiver(post_save, sender=Subscription)
def clear_usage_cache_and_counters(sender, instance, created, **kwargs):
    # The only goal here is to update data for the relevant user/org,
    # so we just return early if we are unable to find one
    subscription_metadata = instance.metadata
    if not subscription_metadata:
        return

    user_id = subscription_metadata.get('kpi_owner_user_id', '')
    if not user_id:
        return

    user = User.objects.filter(id=user_id).first()
    if not user:
        return

    ServiceUsageCalculator(user).clear_cache()

    counters = ExceededLimitCounter.objects.filter(user=user)
    for counter in counters:
        update_or_remove_limit_counter(counter)


@djstripe_receiver('customer.subscription.updated')
def handle_unpaid_subscription(sender, **kwargs):
    """
    Inspects incoming subscription updates.
    If a subscription falls into 'unpaid' status and does NOT have
    'preserve_unpaid_status': 'true' in its product metadata, force cancel it.
    """
    event = kwargs.get('event')
    if not event:
        return

    subscription_data = event.data.get('object', {})
    if subscription_data.get('status') != 'unpaid':
        return

    items = subscription_data.get('items', {}).get('data', [])
    if not items:
        return

    price_data = items[0].get('price', {})
    product_data = price_data.get('product')

    product_metadata = {}
    if isinstance(product_data, dict):
        product_metadata = product_data.get('metadata', {})
    elif isinstance(product_data, str):
        # Fallback to local database lookup via djstripe's Product model
        product = Product.objects.filter(id=product_data).first()
        if product:
            product_metadata = product.metadata or {}

    if product_metadata.get('preserve_unpaid_status') == 'true':
        return

    djstripe_sub = kwargs.get('instance')

    if djstripe_sub and hasattr(djstripe_sub, 'cancel'):
        djstripe_sub.cancel(at_period_end=False)
    else:
        # If your older djstripe version doesn't attach the instance cleanly,
        # fall back to direct DB lookup
        stripe_id = subscription_data.get('id')
        if stripe_id:
            local_sub = Subscription.objects.filter(id=stripe_id).first()
            if local_sub:
                local_sub.cancel(at_period_end=False)
