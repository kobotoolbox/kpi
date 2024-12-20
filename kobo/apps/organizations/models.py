from functools import partial
from typing import Literal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.db.models import F
from django_request_cache import cache_for_request
from django.utils.translation import gettext_lazy as t

if settings.STRIPE_ENABLED:
    from djstripe.models import Customer, Subscription

    from kobo.apps.stripe.constants import (
        ACTIVE_STRIPE_STATUSES,
    )

from organizations.abstract import (
    AbstractOrganization,
    AbstractOrganizationInvitation,
    AbstractOrganizationOwner,
    AbstractOrganizationUser,
)
from organizations.utils import create_organization as create_organization_base

from kpi.fields import KpiUidField
from kpi.utils.mailer import EmailMessage, Mailer

from .constants import (
    ORG_ADMIN_ROLE,
    ORG_EXTERNAL_ROLE,
    ORG_MEMBER_ROLE,
    ORG_OWNER_ROLE,
)
from .exceptions import NotMultiMemberOrganizationException

OrganizationRole = Literal[
    ORG_ADMIN_ROLE, ORG_EXTERNAL_ROLE, ORG_MEMBER_ROLE, ORG_OWNER_ROLE
]


class OrganizationType(models.TextChoices):
    NON_PROFIT = 'non-profit', t('Non-profit organization')
    GOVERNMENT = 'government', t('Government institution')
    EDUCATIONAL = 'educational', t('Educational organization')
    COMMERCIAL = 'commercial', t('A commercial/for-profit company')
    NONE = 'none', t('I am not associated with any organization')


class OrganizationInviteStatusChoices(models.TextChoices):

    ACCEPTED = 'accepted'
    CANCELLED = 'cancelled'
    COMPLETE = 'complete'
    DECLINED = 'declined'
    EXPIRED = 'expired'
    FAILED = 'failed'
    IN_PROGRESS = 'in_progress'
    PENDING = 'pending'
    RESENT = 'resent'


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)
    mmo_override = models.BooleanField(
        default=False,
        verbose_name='Make organization multi-member (necessary for adding users)'
    )
    website = models.CharField(default='', max_length=255)
    organization_type = models.CharField(
        default=OrganizationType.NONE,
        max_length=20,
        choices=OrganizationType.choices,
    )

    def add_user(self, user, is_admin=False):
        if not self.is_mmo and self.users.all().count():
            raise NotMultiMemberOrganizationException

        user.organization.delete()
        super().add_user(user, is_admin=is_admin)

    @cache_for_request
    def active_subscription_billing_details(self):
        """
        Retrieve the billing dates, interval, and product/price metadata for the
        organization's newest subscription
        Returns None if Stripe is not enabled
        The status types that are considered 'active' are determined by
        ACTIVE_STRIPE_STATUSES
        """
        # Only check for subscriptions if Stripe is enabled
        if not settings.STRIPE_ENABLED:
            return None

        return (
            Organization.objects.prefetch_related('djstripe_customers')
            .filter(
                djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
                djstripe_customers__subscriber=self.id,
            )
            .order_by('-djstripe_customers__subscriptions__start_date')
            .values(
                billing_cycle_anchor=F(
                    'djstripe_customers__subscriptions__billing_cycle_anchor'
                ),
                current_period_start=F(
                    'djstripe_customers__subscriptions__current_period_start'
                ),
                current_period_end=F(
                    'djstripe_customers__subscriptions__current_period_end'
                ),
                recurring_interval=F(
                    'djstripe_customers__subscriptions__items__price__recurring__interval'  # noqa: E501
                ),
                product_metadata=F(
                    'djstripe_customers__subscriptions__items__price__product__metadata'
                ),
                price_metadata=F(
                    'djstripe_customers__subscriptions__items__price__metadata'
                ),
            )
            .first()
        )

    @cache_for_request
    def canceled_subscription_billing_cycle_anchor(self):
        """
        Returns cancelation date of most recently canceled subscription
        """
        # Only check for subscriptions if Stripe is enabled
        if settings.STRIPE_ENABLED:
            qs = (
                Organization.objects.prefetch_related('djstripe_customers')
                .filter(
                    djstripe_customers__subscriptions__status='canceled',
                    djstripe_customers__subscriber=self.id,
                )
                .order_by('-djstripe_customers__subscriptions__ended_at')
                .values(
                    anchor=F('djstripe_customers__subscriptions__ended_at'),
                )
                .first()
            )
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

    @classmethod
    @cache_for_request
    def get_from_user_id(cls, user_id: int) -> 'Organization':
        """
        Get organization that this user is a member of.
        """
        # TODO: validate this is the correct way to get a user's organization
        org = (
            cls.objects.filter(
                organization_users__user__id=user_id,
            )
            .order_by('-organization_users__created')
            .first()
        )

        return org

    @cache_for_request
    def get_user_role(self, user: 'User') -> OrganizationRole:

        if not self.users.filter(pk=user.pk).exists():
            return ORG_EXTERNAL_ROLE

        if self.is_owner(user):
            return ORG_OWNER_ROLE

        if self.is_admin(user):
            return ORG_ADMIN_ROLE

        return ORG_MEMBER_ROLE

    @cache_for_request
    def is_admin(self, user: 'User') -> bool:
        """
        Only extends super() to add decorator @cache_for_request and avoid
        multiple calls to DB in the same request.
        """

        # Be aware: Owners are also Admins
        return super().is_admin(user)

    @property
    @cache_for_request
    def is_mmo(self):
        """
        Determines if the multi-members feature is active for the organization

        This returns True if:
        - A superuser has enabled the override (`mmo_override`), or
        - The organization has an active subscription to a plan with
          mmo_enabled set to 'true' in the Stripe product metadata.

        If the override is enabled, it takes precedence over the subscription status
        """
        if self.mmo_override:
            return True

        if billing_details := self.active_subscription_billing_details():
            if product_metadata := billing_details.get('product_metadata'):
                return product_metadata.get('mmo_enabled') == 'true'

        return False

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


class OrganizationUser(AbstractOrganizationUser):

    def __str__(self):
        return f'{self.user.username} (#{self.pk})'

    @property
    def active_subscription_statuses(self):
        """
        Return a list of unique active subscriptions for the organization user.
        """
        try:
            customer = Customer.objects.get(subscriber=self.organization.id)
            subscriptions = Subscription.objects.filter(
                customer=customer,
                status__in=ACTIVE_STRIPE_STATUSES,
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
        Return a comma-separated string of active subscriptions for the
        organization user.
        """
        return ', '.join(self.active_subscription_statuses)


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    status = models.CharField(
        max_length=11,
        choices=OrganizationInviteStatusChoices.choices,
        default=OrganizationInviteStatusChoices.PENDING,
    )

    def send_acceptance_email(self):
        pass

    def send_invite_email(self):
        """
        Sends an email to invite a user to join a team as an admin.

        ToDo: Implement this method properly
        """
        template_variables = {
            'sender_username': self.invited_by.username,
            'sender_email': self.invited_by.email,
            'invitee_username': self.invitee.username if self.invitee else self.invitee_identifier,
            'organization_name': self.invited_by.organization.name,
            'base_url': settings.KOBOFORM_URL,
            'invite_uid': self.guid,
        }

        email_message = EmailMessage(
            to=self.invitee.email if self.invitee else self.invitee_identifier,
            subject="Invitation to Join the Organization",
            plain_text_content_or_template='emails/new_invite.txt',
            template_variables=template_variables,
            html_content_or_template='emails/new_invite.html',
            language=self.invitee.extra_details.data.get('last_ui_language') if self.invitee else 'en',
        )

        Mailer.send(email_message)

    def send_refusal_email(self):
        pass


create_organization = partial(create_organization_base, model=Organization)
