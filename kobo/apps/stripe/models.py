from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.models import Subscription, PaymentIntent, Product

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'storage_byte_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


class PlanAddOn(models.Model):
    limits_available = models.JSONField()
    limits_used = models.JSONField(default=get_default_add_on_limits)
    purchase_date = models.DateTimeField()
    product = models.ForeignKey(Product, to_field='id', on_delete=models.SET_NULL, null=True, blank=True)


@receiver(post_save, sender=PaymentIntent)
def make_one_time_add_on(sender, instance, created, **kwargs):
    # only one-time purchases can have metadata on the PaymentIntent
    if created and instance.metadata.price_id:
        product = Product.objects.get(prices_id=instance.metadata.price_id, livemode=settings.STRIPE_LIVE_MODE)
        if product.metadata['product_type'] != 'addon':
            return
        plan = PlanAddOn.objects.create(
            product=product,
            limits_available=product.metadata,
            purchase_date=instance
        )
        plan.save()


def get_add_on_limits_for_user(user_id):
    limits = get_default_add_on_limits()

    subscription_add_ons = Subscription.objects.filter(
        customer__subscriber__organization_user__user__id=user_id,
        status__in=ACTIVE_STRIPE_STATUSES,
        items__plan__product__metadata__product_type='addon',
    )
    one_time_payment_intents = PaymentIntent.objects.only('metadata').filter(
        customer__subscriber__organization_users__user__id=user_id,
        status='succeeded',
    ).values('metadata')
    one_time_products = Product.objects.filter

    return limits
