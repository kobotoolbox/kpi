from typing import Literal
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.db.models import F
from django_request_cache import cache_for_request

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
from .constants import (
    ADMIN_ORG_ROLE,
    EXTERNAL_ORG_ROLE,
    MEMBER_ORG_ROLE,
    OWNER_ORG_ROLE,
)

OrganizationRole = Literal[
    ADMIN_ORG_ROLE, EXTERNAL_ORG_ROLE, MEMBER_ORG_ROLE, OWNER_ORG_ROLE
]


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)
    mmo_override = models.BooleanField(
        default=False, verbose_name='Multi-members override'
    )

    @cache_for_request
    def active_subscription_billing_details(self):
        """
        Retrieve the billing dates and interval for the organization's newest active subscription
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
                ).first()

        return None

    @cache_for_request
    def canceled_subscription_billing_cycle_anchor(self):
        """
        Returns cancelation date of most recently canceled subscription
        """
        # Only check for subscriptions if Stripe is enabled
        if settings.STRIPE_ENABLED:
            qs = Organization.objects.prefetch_related('djstripe_customers').filter(
                    djstripe_customers__subscriptions__status='canceled',
                    djstripe_customers__subscriber=self.id,
                ).order_by(
                    '-djstripe_customers__subscriptions__ended_at'
                ).values(
                    anchor=F('djstripe_customers__subscriptions__ended_at'),
                ).first()
            if qs:
                return qs['anchor']

        return None

    @property
    def email(self):
        """
        As organization is our customer model for Stripe, Stripe requires that
        it has an email address attribute.
        """
        try:
            return self.owner_user_object.email
        except AttributeError:
            return

    @cache_for_request
    def is_admin(self, user: 'User') -> bool:
        """
        Only extends super() to add decorator @cache_for_request and avoid
        multiple calls to DB in the same request.
        """

        # Be aware: Owners are also Admins
        return super().is_admin(user)

    @cache_for_request
    def is_admin_only(self, user: 'User') -> bool:

        # Be aware: Owners are also Admins
        return super().is_admin(user) and not self.is_owner(user)

    @cache_for_request
    def is_owner(self, user: 'User') -> bool:
        """
        Overrides `is_owner()` with `owner_user_object()` instead of
        using `super().is_owner()` to take advantage of `@cache_for_request`
        in both scenarios.
        (i.e., when calling either `is_owner()` or `owner_user_object()`).
        """

        return self.owner_user_object == user

    @property
    @cache_for_request
    def owner_user_object(self) -> 'User':

        try:
            return self.owner.organization_user.user
        except ObjectDoesNotExist:
            return

    def get_user_role(self, user: 'User') -> OrganizationRole:

        if not self.users.filter(pk=user.pk).exists():
            return EXTERNAL_ORG_ROLE

        if self.is_owner(user):
            return OWNER_ORG_ROLE

        if self.is_admin(user):
            return ADMIN_ORG_ROLE

        return MEMBER_ORG_ROLE


class OrganizationUser(AbstractOrganizationUser):
    @property
    def active_subscription_statuses(self):
        """
        Return a list of unique active subscriptions for the organization user.
        """
        try:
            customer = Customer.objects.get(subscriber=self.organization.id)
            subscriptions = Subscription.objects.filter(
                customer=customer, status="active"
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
        Return a comma-separated string of active subscriptions for the organization
        user.
        """
        return ', '.join(self.active_subscription_statuses)


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass


create_organization = partial(create_organization_base, model=Organization)
