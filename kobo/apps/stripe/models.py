from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from djstripe.models import Charge, Price

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils import get_default_add_on_limits, get_default_valid_subscription_products
from kpi.fields import KpiUidField

# TODO: implement subscription restrictions


class PlanAddOn(models.Model):
    id = KpiUidField(uid_prefix='addon_', primary_key=True)
    created = models.DateTimeField()
    organization = models.ForeignKey('organizations.Organization', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    usage_limits = models.JSONField(
        default=get_default_add_on_limits,
        help_text='''The historical usage limits when the add-on was purchased.
        Multiply this value by `quantity` to get the total limits for this add-on. Possible keys:
        "submission_limit", "asr_seconds_limit", and/or "mt_characters_limit"''',
    )
    limits_used = models.JSONField(
        default=get_default_add_on_limits,
        help_text='The amount of each of the add-on\'s individual limits that has been used.',
    )
    product = models.ForeignKey('djstripe.Product', to_field='id', on_delete=models.SET_NULL, null=True, blank=True)
    charge = models.ForeignKey('djstripe.Charge', to_field='id', on_delete=models.CASCADE)
    valid_subscription_products = models.JSONField(default=get_default_valid_subscription_products)
    created = models.DateTimeField(help_text='The time when the add-on purchased.')
    id = KpiUidField(uid_prefix='addon_', primary_key=True)

    class Meta:
        verbose_name = 'plan add-on'
        verbose_name_plural = 'plan add-ons'

    @property
    def is_expended(self):
        """
        Whether the addon is at/over its usage limits.
        """
        for limit_type, limit_value in self.usage_limits.items():
            if limit_type in self.limits_used and self.limits_used[limit_type] >= limit_value > 0:
                return True
        return False

    @property
    def total_usage_limits(self):
        """
        The total usage limits for this addon, based on the usage_limits for a single add-on and the quantity.
        """
        return {key: value * self.quantity for key, value in self.usage_limits.items()}

    @property
    def is_available(self):
        return self.charge.payment_intent.status == 'succeeded' and not (self.is_expended or self.charge.refunded)

    @property
    def limits_available(self):
        limits = {}
        for limit_type, limit_amount in self.limits_used.items():
            limits_available = self.total_usage_limits[limit_type] - self.limits_used[limit_type]
            limits[limit_type] = max(limits_available, 0)
        return limits

    def increment(self, limit_type, amount_used):
        """
        Increments the usage counter for limit_type by amount_used.
        Returns the amount of this add-on that was used (up to its limit).
        Will return 0 if limit_type does not apply to this add-on.
        """
        if limit_type in self.usage_limits.keys():
            limit_available = self.limits_available[limit_type]
            amount_to_use = min(amount_used, limit_available)
            self.limits_used[limit_type] += amount_to_use
            self.save()
            return amount_to_use
        return 0

    @staticmethod
    def create_or_update_one_time_add_on(charge):
        """
        Create a PlanAddOn object from a Charge object, if the Charge is for a one-time add-on.
        Returns True if a PlanAddOn was created, false otherwise.
        """
        if 'price_id' not in charge.metadata or 'quantity' not in charge.metadata:
            # make sure the charge is for a successful addon purchase
            return False

        try:
            product = Price.objects.get(
                id=charge.metadata['price_id']
            ).product
            organization = Organization.objects.get(id=charge.metadata['organization_id'])
        except ObjectDoesNotExist:
            return False

        if product.metadata['product_type'] != 'addon':
            # might be some other type of payment
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
            add_on.quantity = int(charge.metadata['quantity'])
            add_on.organization = organization
            add_on.usage_limits = usage_limits
            add_on.limits_used = limits_used
            add_on.valid_subscription_products = valid_subscription_products
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
    def increment_add_ons_for_user(user_id: int, usage_type: str, amount: int):
        """
        Increments the usage counter for limit_type by amount_used for a given user.
        Will always increment the add-on with the most used first, so that add-ons are used up in FIFO order.
        Returns the amount of usage that was not applied to an add-on.
        """
        add_ons = PlanAddOn.objects.filter(
            organization__organization_users__user__id=user_id,
            usage_limits__has_key=usage_type,
            charge__refunded=False,
            charge__payment_intent__status='succeeded',
        ).order_by(f'-limits_used__{usage_type}')
        remaining = amount
        for add_on in add_ons.iterator():
            if add_on.is_available and remaining:
                remaining -= add_on.increment(limit_type=usage_type, amount_used=remaining)
        return remaining


@receiver(post_save, sender=Charge)
def make_add_on_for_charge(sender, instance, created, **kwargs):
    PlanAddOn.create_or_update_one_time_add_on(instance)
