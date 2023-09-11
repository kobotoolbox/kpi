from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist, ValidationError
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.models import Subscription, Price, Charge

from kobo.apps.organizations.models import Organization
from kpi.fields import KpiUidField


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


def get_default_valid_subscription_products():
    return []


class PlanAddOn(models.Model):
    id = KpiUidField(uid_prefix='addon_', primary_key=True)
    created = models.DateTimeField()
    organization = models.ForeignKey('organizations.Organization', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='''The historical usage limits when the add-on was purchased. Possible keys:
        "submission_limit", "asr_seconds_limit", and/or "mt_characters_limit"''',
    )
    limits_used = models.JSONField(
        default=get_default_add_on_limits,
        help_text='The amount of each of the add-on\'s individual limits that has been used.',
    )
    product = models.ForeignKey('djstripe.Product', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    charge = models.ForeignKey('djstripe.Charge', to_field='id', on_delete=models.CASCADE)
    valid_subscription_products = models.JSONField(default=get_default_valid_subscription_products)

    class Meta:
        verbose_name = 'plan add-on'
        verbose_name_plural = 'plan add-ons'

    @property
    def is_expended(self):
        for limit_type, limit_value in self.usage_limits.items():
            if limit_type in self.limits_used and self.limits_used[limit_type] >= limit_value > 0:
                return True
        return False

    @property
    def is_available(self):
        return self.charge.payment_intent.status == 'succeeded' and not (self.is_expended or self.charge.refunded)

    @property
    def limits_available(self):
        limits = {}
        for limit_type, limit_amount in self.limits_used.items():
            limits_available = self.usage_limits[limit_type] - self.limits_used[limit_type]
            limits[limit_type] = max(limits_available, 0)
        return limits

    def increment_add_on(self, limit_type, amount_used):
        if limit_type in self.usage_limits.keys():
            limit_available = self.limits_available[limit_type]
            self.usage_limits[limit_type] += min(amount_used, limit_available)
            self.save()
            return True
        return False


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    create_or_update_one_time_add_on(instance)


def create_or_update_one_time_add_on(charge):
    """
    Create a PlanAddOn object from a Charge object, if the Charge is for a one-time add-on.
    Returns True if a PlanAddOn was created, false otherwise.
    """
    if 'price_id' not in charge.metadata:
        # make sure the charge is for a successful addon purchase
        return False

    try:
        product = Price.objects.get(
            id=charge.metadata['price_id']
        ).product
        organization = Organization.objects.get(id=charge.metadata['organization_id'])
    except ObjectDoesNotExist:
        print('no product or org')
        return False

    if product.metadata['product_type'] != 'addon':
        # might be some other type of payment
        print('no product type metadata')
        return False

    valid_subscription_products = []
    if 'valid_subscription_products' in product.metadata:
        for product_id in product.metadata['valid_subscription_products'].split(','):
            valid_subscription_products.append(product_id)

    usage_limits = {}
    limits_used = {}
    for limit_type in get_default_add_on_limits().keys():
        if limit_type in charge.metadata:
            limit_value = charge.metadata[limit_type]
            usage_limits[limit_type] = int(limit_value)
            limits_used[limit_type] = 0

    if not len(usage_limits):
        # not a valid plan add-on
        return False

    add_on, add_on_created = PlanAddOn.objects.get_or_create(charge=charge, created=charge.created)
    if add_on_created:
        add_on.product = product
        add_on.organization = organization
        add_on.usage_limits = usage_limits
        add_on.limits_used = limits_used
        add_on.valid_subscription_products = valid_subscription_products
        add_on.save()
    return add_on_created


def make_add_ons_from_existing_charges():
    created_count = 0
    for charge in Charge.objects.all().iterator(chunk_size=50):
        if create_or_update_one_time_add_on(charge):
            created_count += 1
    return created_count

