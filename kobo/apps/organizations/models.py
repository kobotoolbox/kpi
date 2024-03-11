from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models import F
from django.utils import timezone


if settings.STRIPE_ENABLED:
   from djstripe.models import Customer, Subscription
from functools import partial

from organizations.abstract import (
    AbstractOrganization,
    AbstractOrganizationInvitation,
    AbstractOrganizationOwner,
    AbstractOrganizationUser,
)
from organizations.utils import create_organization as create_organization_base

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kpi.fields import KpiUidField


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)
    asr_seconds_month = models.PositiveIntegerField(blank=True, null=True, default=None)
    asr_seconds_year = models.PositiveIntegerField(blank=True, null=True, default=None)
    mt_characters_month = models.PositiveIntegerField(blank=True, null=True, default=None)
    mt_characters_year = models.PositiveIntegerField(blank=True, null=True, default=None)
    usage_updated = models.DateTimeField(blank=True, null=True, default=None)

    @property
    def email(self):
        """
        As organization is our customer model for Stripe, Stripe requires that
        it has an email address attribute
        """
        return self.owner.organization_user.user.email

    @property
    def active_subscription_billing_details(self):
        """
        Retrieve the billing dates, interval, and product/price metadata for the organization's newest subscription
        Returns None if Stripe is not enabled
        The status types that are considered 'active' are determined by ACTIVE_STRIPE_STATUSES
        """
        # Only check for subscriptions if Stripe is enabled
        if settings.STRIPE_ENABLED:
            return Organization.objects.prefetch_related('djstripe_customers').filter(
                    djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
                    djstripe_customers__subscriber=self.id,
                ).order_by(
                    '-djstripe_customers__subscriptions__start_date'
                ).values(
                    billing_cycle_anchor=F('djstripe_customers__subscriptions__billing_cycle_anchor'),
                    current_period_start=F('djstripe_customers__subscriptions__current_period_start'),
                    current_period_end=F('djstripe_customers__subscriptions__current_period_end'),
                    recurring_interval=F('djstripe_customers__subscriptions__items__price__recurring__interval'),
                    product_metadata=F('djstripe_customers__subscriptions__items__price__product__metadata'),
                    price_metadata=F('djstripe_customers__subscriptions__items__price__metadata')
                ).first()

        return None

    def update_usage_cache(self, service_usage: dict):
        self.asr_seconds_month = service_usage['total_nlp_usage']['asr_seconds_current_month']
        self.asr_seconds_year = service_usage['total_nlp_usage']['asr_seconds_current_year']
        self.mt_characters_month = service_usage['total_nlp_usage']['mt_characters_current_month']
        self.mt_characters_year = service_usage['total_nlp_usage']['mt_characters_current_year']
        self.usage_updated = timezone.now()
        return self.save()


class OrganizationUser(AbstractOrganizationUser):
    @property
    def active_subscription_statuses(self):
        """
        Return a list of unique active subscriptions for the organization user.
        """
        try:
            customer = Customer.objects.get(subscriber=self.organization.id)
            subscriptions = Subscription.objects.filter(
                customer=customer, status__in=ACTIVE_STRIPE_STATUSES,
            )

            unique_plans = set()
            for subscription in subscriptions:
                unique_plans.add(str(subscription.plan))

            return list(unique_plans)
        except (Customer.DoesNotExist, Subscription.DoesNotExist):
            return []

    @property
    def active_subscription_status(self):
        """
        Return a comma-separated string of active subscriptions for the organization user.
        """
        return ', '.join(self.active_subscription_statuses)


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass


create_organization = partial(create_organization_base, model=Organization)
