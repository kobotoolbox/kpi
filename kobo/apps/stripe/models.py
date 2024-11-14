from typing import List

from django.contrib import admin
from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, IntegerField, Sum
from django.db.models.functions import Cast, Coalesce
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.enums import PaymentIntentStatus
from djstripe.models import Charge, Price, Subscription

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES, USAGE_LIMIT_MAP
from kobo.apps.stripe.utils import get_default_add_on_limits
from kpi.fields import KpiUidField
from kpi.utils.django_orm_helper import DeductUsageValue


class PlanAddOn(models.Model):
    id = KpiUidField(uid_prefix='addon_', primary_key=True)
    created = models.DateTimeField(help_text='The time when the add-on purchased.')
    organization = models.ForeignKey(
        'organizations.Organization',
        to_field='id',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='''The historical usage limits when the add-on was purchased.
        Multiply this value by `quantity` to get the total limits for this add-on.
        Possible keys:
        "submission_limit", "asr_seconds_limit", and/or "mt_characters_limit"''',
    )
    limits_remaining = models.JSONField(
        default=get_default_add_on_limits,
        help_text="The amount of each of the add-on's individual limits left to use.",
    )
    product = models.ForeignKey(
        'djstripe.Product',
        to_field='id',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    charge = models.ForeignKey(
        'djstripe.Charge', to_field='id', on_delete=models.CASCADE
    )

    class Meta:
        verbose_name = 'plan add-on'
        verbose_name_plural = 'plan add-ons'
        indexes = [
            models.Index(fields=['organization', 'limits_remaining', 'charge']),
        ]

    @staticmethod
    def create_or_update_one_time_add_on(charge: Charge):
        """
        Create a PlanAddOn object from a Charge object, if the Charge is for a
        one-time add-on.

        Returns True if a PlanAddOn was created, false otherwise.
        """
        if (
            charge.payment_intent.status != PaymentIntentStatus.succeeded
            or not charge.metadata.get('price_id', None)
            or not charge.metadata.get('quantity', None)
        ):
            # make sure the charge is for a successful addon purchase
            return False

        try:
            product = Price.objects.get(id=charge.metadata.get('price_id', '')).product
            organization = Organization.objects.get(
                id=charge.metadata['organization_id']
            )
        except ObjectDoesNotExist:
            # no product/price/org/subscription, just bail
            return False

        if product.metadata.get('product_type', '') != 'addon_onetime':
            # might be some other type of payment
            return False

        tags = product.metadata.get('valid_tags', '').split(',')
        if (
            tags
            and ('all' not in tags)
            and not Subscription.objects.filter(
                customer__subscriber=organization,
                items__price__product__metadata__has_key__in=[tags],
                status__in=ACTIVE_STRIPE_STATUSES,
            ).exists()
        ):
            # this user doesn't have the subscription level they need for this addon
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

        add_on, add_on_created = PlanAddOn.objects.get_or_create(
            charge=charge, created=charge.djstripe_created
        )
        if add_on_created:
            add_on.product = product
            add_on.quantity = int(charge.metadata['quantity'])
            add_on.organization = organization
            add_on.usage_limits = usage_limits
            add_on.limits_remaining = limits_remaining
            add_on.save()
        return add_on_created

    @staticmethod
    def get_organization_totals(
        organization: 'Organization', usage_type: UsageType
    ) -> (int, int):
        """
        Returns the total limit and the total remaining usage for a given organization
        and usage type.
        """
        usage_mapped = USAGE_LIMIT_MAP[usage_type]
        limit_key = f'{usage_mapped}_limit'
        limit_field = f'limits_remaining__{limit_key}'
        usage_field = f'usage_limits__{limit_key}'
        totals = PlanAddOn.objects.filter(
            organization__id=organization.id,
            limits_remaining__has_key=limit_key,
            usage_limits__has_key=limit_key,
            charge__refunded=False,
        ).aggregate(
            total_usage_limit=Coalesce(
                Sum(Cast(usage_field, output_field=IntegerField()) * F('quantity')),
                0,
                output_field=IntegerField(),
            ),
            total_remaining=Coalesce(
                Sum(Cast(limit_field, output_field=IntegerField())),
                0,
            ),
        )

        return totals['total_usage_limit'], totals['total_remaining']

    @property
    def is_expended(self):
        """
        Whether the addon is at/over its usage limits.
        """
        for limit_type, limit_value in self.limits_remaining.items():
            if limit_value > 0:
                return False
        return True

    @admin.display(boolean=True, description='available')
    def is_available(self):
        return not (self.is_expended or self.charge.refunded) and bool(
            self.organization
        )

    def deduct(self, limit_type, amount_used):
        """
        Deducts the add on usage counter for limit_type by amount_used.
        Returns the amount of this add-on that was used (up to its limit).
        Will return 0 if limit_type does not apply to this add-on.
        """
        if limit_type in self.usage_limits.keys():
            limit_available = self.limits_remaining.get(limit_type)
            amount_to_use = min(amount_used, limit_available)
            PlanAddOn.objects.filter(pk=self.id).update(
                limits_remaining=DeductUsageValue(
                    'limits_remaining', keyname=limit_type, amount=amount_used
                )
            )
            return amount_to_use
        return 0

    @staticmethod
    def make_add_ons_from_existing_charges():
        """
        Create a PlanAddOn object for each eligible Charge object in the database.
        Does not refresh Charge data from Stripe.
        Returns the number of PlanAddOns created.
        """
        created_count = 0
        # TODO: This should filter out charges that are already matched to an add on
        for charge in Charge.objects.all().iterator(chunk_size=500):
            if PlanAddOn.create_or_update_one_time_add_on(charge):
                created_count += 1
        return created_count

    @staticmethod
    def deduct_add_ons_for_organization(
        organization: 'Organization', usage_type: UsageType, amount: int
    ):
        """
        Deducts the usage counter for limit_type by amount_used for a given user.
        Will always spend the add-on with the most used first, so that add-ons
        are used up in FIFO order.

        Returns the amount of usage that was not applied to an add-on.
        """
        usage_mapped = USAGE_LIMIT_MAP[usage_type]
        limit_key = f'{usage_mapped}_limit'
        metadata_key = f'limits_remaining__{limit_key}'
        add_ons = PlanAddOn.objects.filter(
            organization__id=organization.id,
            limits_remaining__has_key=limit_key,
            charge__refunded=False,
            **{f'{metadata_key}__gt': 0},
        ).order_by(metadata_key)
        remaining = amount
        for add_on in add_ons.iterator():
            if add_on.is_available():
                remaining -= add_on.deduct(limit_type=limit_key, amount_used=remaining)
        return remaining

    @property
    def total_usage_limits(self):
        """
        The total usage limits for this add-on, based on the usage_limits for a single
        add-on and the quantity.
        """
        return {key: value * self.quantity for key, value in self.usage_limits.items()}

    @property
    def valid_tags(self) -> List:
        """
        The tag metadata (on the subscription product/price) needed to view/purchase
        this add-on. If the org that purchased this add-on no longer has that a plan
        with those tags, the add-on will be inactive. If the add-on doesn't require a
        tag, this property will return an empty list.
        """
        return self.product.metadata.get('valid_tags', '').split(',')


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    PlanAddOn.create_or_update_one_time_add_on(instance)
