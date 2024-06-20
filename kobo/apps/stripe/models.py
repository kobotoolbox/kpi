from typing import List

from django.contrib import admin
from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.enums import PaymentIntentStatus
from djstripe.models import Charge, Price, Subscription

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES, USAGE_LIMIT_MAP
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.utils import get_default_add_on_limits
from kpi.fields import KpiUidField


class PlanAddOn(models.Model):
    id = KpiUidField(uid_prefix='addon_', primary_key=True)
    created = models.DateTimeField(help_text='The time when the add-on purchased.')
    organization = models.ForeignKey(
        'organizations.Organization',
        to_field='id',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='''The historical usage limits when the add-on was purchased.
        Multiply this value by `quantity` to get the total limits for this add-on. Possible keys:
        "submission_limit", "asr_seconds_limit", and/or "mt_characters_limit"''',
    )
    limits_remaining = models.JSONField(
        default=get_default_add_on_limits,
        help_text='The amount of each of the add-on\'s individual limits left to use.',
    )
    product = models.ForeignKey('djstripe.Product', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    charge = models.ForeignKey('djstripe.Charge', to_field='id', on_delete=models.CASCADE)

    class Meta:
        verbose_name = 'plan add-on'
        verbose_name_plural = 'plan add-ons'
        indexes = [
            models.Index(fields=['organization', 'limits_remaining', 'charge']),
        ]

    @property
    def is_expended(self):
        """
        Whether the addon is at/over its usage limits.
        """
        for limit_type, limit_value in self.limits_remaining.items():
            if limit_value > 0:
                return False
        return True

    @property
    def total_usage_limits(self):
        """
        The total usage limits for this add-on, based on the usage_limits for a single add-on and the quantity.
        """
        return {key: value * self.quantity for key, value in self.usage_limits.items()}

    @property
    def valid_tags(self) -> List:
        """
        The tag metadata (on the subscription product/price) needed to view/purchase this add-on.
        If the org that purchased this add-on no longer has that a plan with those tags, the add-on will be inactive.
        If the add-on doesn't require a tag, this property will return an empty list.
        """
        return self.product.metadata.get('valid_tags', '').split(',')

    @admin.display(boolean=True, description='available')
    def is_available(self):
        return self.charge.payment_intent.status == PaymentIntentStatus.succeeded and not (
            self.is_expended or self.charge.refunded
        ) and bool(self.organization)

    def increment(self, limit_type, amount_used):
        """
        Increments the usage counter for limit_type by amount_used.
        Returns the amount of this add-on that was used (up to its limit).
        Will return 0 if limit_type does not apply to this add-on.
        """
        if limit_type in self.usage_limits.keys():
            limit_available = self.limits_remaining.get(limit_type)
            amount_to_use = min(amount_used, limit_available)
            self.limits_remaining[limit_type] -= amount_to_use
            self.save()
            return amount_to_use
        return 0

    @staticmethod
    def create_or_update_one_time_add_on(charge: Charge):
        """
        Create a PlanAddOn object from a Charge object, if the Charge is for a one-time add-on.
        Returns True if a PlanAddOn was created, false otherwise.
        """
        if not charge.metadata.get('price_id', None) or not charge.metadata.get('quantity', None):
            # make sure the charge is for a successful addon purchase
            return False

        try:
            product = Price.objects.get(
                id=charge.metadata.get('price_id', '')
            ).product
            organization = Organization.objects.get(id=charge.metadata['organization_id'])
        except ObjectDoesNotExist:
            # no product/price/org/subscription, just bail
            return False

        if product.metadata.get('product_type', '') != 'addon_onetime':
            # might be some other type of payment
            return False

        tags = product.metadata.get('valid_tags', '').split(',')
        if tags and ('all' not in tags) and not Subscription.objects.filter(
            customer__subscriber=organization,
            items__price__product__metadata__has_key__in=[tags],
            status__in=ACTIVE_STRIPE_STATUSES
        ).exists():
            # this user doesn't have the subscription level they need for this addon, bail
            return False

        quantity = int(charge.metadata['quantity'])
        usage_limits = {}
        limits_remaining = {}
        for limit_type in get_default_add_on_limits().keys():
            limit_value = charge.metadata.get(limit_type, None)
            if limit_value is not None:
                usage_limits[limit_type] = int(limit_value)
                limits_remaining[limit_type] = int(limit_value) * quantity

        if not len(usage_limits):
            # not a valid plan add-on
            return False

        add_on, add_on_created = PlanAddOn.objects.get_or_create(charge=charge, created=charge.djstripe_created)
        if add_on_created:
            add_on.product = product
            add_on.quantity = int(charge.metadata['quantity'])
            add_on.organization = organization
            add_on.usage_limits = usage_limits
            add_on.limits_remaining = limits_remaining
            add_on.save()
        return add_on_created

    @staticmethod
    def make_add_ons_from_existing_charges():
        """
        Create a PlanAddOn object for each eligible Charge object in the database.
        Does not refresh Charge data from Stripe.
        Returns the number of PlanAddOns created.
        """
        created_count = 0
        for charge in Charge.objects.all().iterator(chunk_size=500):
            if PlanAddOn.create_or_update_one_time_add_on(charge):
                created_count += 1
        return created_count

    @staticmethod
    def increment_add_ons_for_user(user_id: int, add_on_type: UsageType, amount: int):
        """
        Increments the usage counter for limit_type by amount_used for a given user.
        Will always increment the add-on with the most used first, so that add-ons are used up in FIFO order.
        Returns the amount of usage that was not applied to an add-on.
        """
        usage_type = USAGE_LIMIT_MAP[add_on_type]
        limit_key = f'{usage_type}_limit'
        metadata_key = f'limits_remaining__{limit_key}'
        add_ons = PlanAddOn.objects.filter(
            organization__organization_users__user__id=user_id,
            limits_remaining__has_key=limit_key,
            charge__refunded=False,
            charge__payment_intent__status=PaymentIntentStatus.succeeded,
            **{f'{metadata_key}__gt': 0}
        ).order_by(metadata_key)
        remaining = amount
        for add_on in add_ons.iterator():
            if not add_on.organization.check_usage_exceeds_plan_limit(
                add_on_type, remaining
            ):
                return remaining
            if add_on.is_available():
                remaining -= add_on.increment(limit_type=limit_key, amount_used=remaining)
        return remaining


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    PlanAddOn.create_or_update_one_time_add_on(instance)
