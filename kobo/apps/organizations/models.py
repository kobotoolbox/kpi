from django.conf import settings

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kpi.fields import KpiUidField

from organizations.abstract import (
    AbstractOrganization,
    AbstractOrganizationInvitation,
    AbstractOrganizationOwner,
    AbstractOrganizationUser,
)

STRIPE_ENABLED = settings.STRIPE_ENABLED
if STRIPE_ENABLED:
    from djstripe.models import Subscription


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
    def active_subscription(self):
        """
        Retrieve the newest active subscription for the organization
        The status types that are considered 'active' are determined by ACTIVE_STRIPE_STATUSES
        """
        if STRIPE_ENABLED:
            # Get the organization's subscription, if they have one
            return Subscription.objects.filter(
                status__in=ACTIVE_STRIPE_STATUSES,
                customer__subscriber=self.id,
            ).order_by('-start_date').first()
        return None


class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass
