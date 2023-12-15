from django.conf import settings
from django.db.models import F
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


class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass


create_organization = partial(create_organization_base, model=Organization)
