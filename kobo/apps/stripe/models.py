from django.conf import settings
from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.models import Subscription, PaymentIntent, Product, Price

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kpi.fields import KpiUidField


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'storage_byte_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


class PlanAddOn(models.Model):
    organization = models.ForeignKey('organizations.Organization', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    payment_intent = models.ForeignKey('djstripe.PaymentIntent', to_field='id', on_delete=models.CASCADE)
    product = models.ForeignKey('djstripe.Product', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='The historical usage limits, when the add-on was purchased.'
    )
    limits_used = models.JSONField(
        default=get_default_add_on_limits,
        help_text='The amount of each of the add-on\'s individual limits that has been used.',
    )
    created = models.DateTimeField()
    id = KpiUidField(uid_prefix='addon_', primary_key=True)

    class Meta:
        verbose_name = 'plan add-on'
        verbose_name_plural = 'plan add-ons'

    @property
    def is_expended(self):
        for limit_type, limit_value in self.usage_limits.items():
            if limit_type in self.limits_used and self.limits_used[limit_type] >= limit_value > 0:
                return True
        return False


@receiver(post_save, sender=PaymentIntent)
def create_or_update_one_time_add_on(sender, instance, created, **kwargs):
    # make sure the PaymentIntent is for a successful addon purchase
    if not instance.metadata['price_id'] or instance.status != 'succeeded':
        return

    try:
        product = Price.objects.get(
            id=instance.metadata['price_id'],
            livemode=settings.STRIPE_LIVE_MODE
        ).product
        organization = Organization.objects.filter(id=instance.metadata['organization_id']).first()
    except MultipleObjectsReturned or ObjectDoesNotExist:
        return

    if not (product and organization) or product.metadata['product_type'] != 'addon':
        return

    usage_limits = {}
    for limit_type in get_default_add_on_limits().keys():
        if limit_type in product.metadata:
            usage_limits[limit_type] = product.metadata[limit_type]
    kwargs = {
        'product': product,
        'organization': organization,
        'payment_intent': instance,
        'usage_limits': usage_limits,
        'created': instance.created,
    }
    if created:
        plan = PlanAddOn.objects.create(**kwargs)
    else:
        plan = PlanAddOn.objects.filter(payment_intent=instance).first()
        if plan:
            plan.update(usage_limits=usage_limits)
        else:
            plan = PlanAddOn.objects.create(**kwargs)
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
