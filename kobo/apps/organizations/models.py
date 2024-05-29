from typing import Union

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone
from django_request_cache import cache_for_request

from kobo.apps.organizations.types import UsageType

if settings.STRIPE_ENABLED:
    from djstripe.models import Customer, Subscription
    from kobo.apps.stripe.constants import (
        ACTIVE_STRIPE_STATUSES,
        ORGANIZATION_USAGE_MAX_CACHE_AGE,
        USAGE_LIMIT_MAP_STRIPE,
        USAGE_LIMIT_MAP,
    )
from functools import partial

from organizations.abstract import (
    AbstractOrganization,
    AbstractOrganizationInvitation,
    AbstractOrganizationOwner,
    AbstractOrganizationUser,
)
from organizations.utils import create_organization as create_organization_base

from kpi.fields import KpiUidField


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)
    asr_seconds_limit = models.PositiveIntegerField(blank=True, null=True, default=None)
    mt_character_limit = models.PositiveIntegerField(blank=True, null=True, default=None)
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
        if not (billing_details := self.active_subscription_billing_details):
            return None
        interval = billing_details['recurring_interval']
        self.asr_seconds_limit = service_usage['total_nlp_usage'][f'asr_seconds_current_{interval}']
        self.mt_character_limit = service_usage['total_nlp_usage'][f'mt_characters_current_{interval}']
        self.usage_updated = timezone.now()
        return self.save()

    @cache_for_request
    def check_usage_exceeds_plan_limit(self, limit_type: UsageType, new_usage = 0) -> Union[bool, None]:
        """
        Check if an organization is at or over their plan's limit for a given usage type or,
        if 'new_usage' kwarg is supplied, whether new usage will put them over their limit
        Returns True if limit is/will be exceeded, false if not.
        Returns None if Stripe isn't enabled or the limit status couldn't be determined
        """
        if not settings.STRIPE_ENABLED:
            return None
        if timezone.now() - self.usage_updated > ORGANIZATION_USAGE_MAX_CACHE_AGE:
            # TODO: re-fetch service usage data if stale
            pass
        cached_usage = self.serializable_value(f'{USAGE_LIMIT_MAP[limit_type]}_limit')
        stripe_key = f'{USAGE_LIMIT_MAP_STRIPE[limit_type]}_limit'
        current_limit = Organization.objects.filter(
            id=self.id,
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
            djstripe_customers__subscriptions__items__price__product__metadata__product_type='plan',
        ).values(
            price_limit=F(f'djstripe_customers__subscriptions__items__price__metadata__{stripe_key}'),
            product_limit=F(f'djstripe_customers__subscriptions__items__price__product__metadata__{stripe_key}'),
        ).first()
        if current_limit:
            relevant_limit = current_limit.get('price_limit') or current_limit.get('product_limit')
        else:
            # TODO: get the limits from the community plan, overrides
            relevant_limit = 2000
        return int(relevant_limit) and cached_usage + new_usage >= int(relevant_limit)


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
