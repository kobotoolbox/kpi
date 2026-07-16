from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.event_handlers import djstripe_receiver
from djstripe.models import Charge, Product, Subscription

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.models import ExceededLimitCounter, PlanAddOn
from kobo.apps.stripe.utils.limit_enforcement import update_or_remove_limit_counter
from kpi.utils.log import logging
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

    preserve_status = False

    for item in items:
        price_data = item.get('price', {})
        product_data = price_data.get('product')

        product_metadata = {}
        if isinstance(product_data, dict):
            product_metadata = product_data.get('metadata', {})
        elif isinstance(product_data, str):
            product = Product.objects.filter(id=product_data).first()
            if product:
                product_metadata = product.metadata or {}
            else:
                logging.warning(
                    f'[Stripe Webhook] Product {product_data} missing in local '
                    f'djstripe sync. Fail-safe triggered: preserving unpaid status.'
                )
                preserve_status = True
                break

        val = str(product_metadata.get('preserve_unpaid_status', '')).strip().lower()
        if val == 'true':
            preserve_status = True
            break

    stripe_id = subscription_data.get('id')

    if preserve_status:
        logging.info(
            f'[Stripe Webhook] Preserving unpaid status for subscription '
            f'{stripe_id} due to product metadata configuration.'
        )
        return

    djstripe_sub = kwargs.get('instance')

    if not djstripe_sub and stripe_id:
        djstripe_sub = Subscription.objects.filter(id=stripe_id).first()

    if djstripe_sub and hasattr(djstripe_sub, 'cancel'):
        logging.info(
            f'[Stripe Webhook] Initiating API cancellation on Stripe for '
            f'unpaid subscription {stripe_id}.'
        )
        try:
            djstripe_sub.cancel(at_period_end=False)
        except Exception as e:
            logging.error(
                f'[Stripe Webhook] Failed to cancel unpaid subscription {stripe_id} '
                f'on Stripe: {e}'
            )
    else:
        logging.warning(
            f'[Stripe Webhook] Unable to cancel unpaid subscription {stripe_id}; '
            f'no local Subscription instance found to execute .cancel()'
        )
