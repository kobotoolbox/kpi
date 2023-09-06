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


class PlanAddOn(models.Model):
    organization = models.ForeignKey('organizations.Organization', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    charge = models.ForeignKey('djstripe.Charge', to_field='id', on_delete=models.CASCADE)
    product = models.ForeignKey('djstripe.Product', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='''The historical usage limits when the add-on was purchased. Possible keys:
        "submission_limit", "asr_seconds_limit", and/or "mt_characters_limit"''',
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

    @property
    def is_available(self):
        return self.charge.payment_intent.status == 'succeeded' and not (self.is_expended or self.charge.refunded)


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    create_or_update_one_time_add_on(instance)


def create_or_update_one_time_add_on(charge):
    payment_intent = charge.payment_intent
    # make sure the charge is for a successful addon purchase
    if payment_intent.status != 'succeeded' or 'price_id' not in charge.metadata:
        return

    try:
        product = Price.objects.get(
            id=charge.metadata['price_id']
        ).product
        organization = Organization.objects.get(id=charge.metadata['organization_id'])
    except MultipleObjectsReturned or ObjectDoesNotExist:
        return

    if product.metadata['product_type'] != 'addon':
        return

    usage_limits = {}
    limits_used = {}
    for limit_type in get_default_add_on_limits().keys():
        if limit_type in charge.metadata:
            limit_value = charge.metadata[limit_type]
            usage_limits[limit_type] = int(limit_value)
            limits_used[limit_type] = 0

    plan, plan_created = PlanAddOn.objects.get_or_create(charge=charge, created=charge.created)
    if plan_created:
        plan.product = product
        plan.organization = organization
        plan.usage_limits = usage_limits
        plan.limits_used = limits_used
        plan.save()


@receiver(post_save, sender=Subscription)
def deactivate_addon_on_subscription_change(sender, instance, created, **kwargs):
    # TODO: Implement me!
    pass
