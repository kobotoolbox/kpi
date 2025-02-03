from functools import partial
from typing import Literal

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.db.models import F
from django_request_cache import cache_for_request
from django.utils.translation import gettext_lazy as t, override

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
from kpi.utils.placeholders import replace_placeholders

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
    DECLINED = 'declined'
    EXPIRED = 'expired'
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

    @classmethod
    def export_resource_classes(cls):
        from .admin.organization_user import OrgUserResource
        return {
            'organization_users': ('Organization users resource', OrgUserResource),
        }


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    status = models.CharField(
        max_length=11,
        choices=OrganizationInviteStatusChoices.choices,
        default=OrganizationInviteStatusChoices.PENDING,
    )
    invitee_role = models.CharField(
        max_length=10,
        choices=[('admin', 'Admin'), ('member', 'Member')],
        default='member',
    )

    def send_acceptance_email(self):
        """
        Send an email to the sender of the invitation to notify them that the
        invitee has accepted the invitation
        """
        sender_language = self.invited_by.extra_details.data.get(
            'last_ui_language', settings.LANGUAGE_CODE
        )

        template_variables = {
            'sender_username': self.invited_by.username,
            'sender_email': self.invited_by.email,
            'recipient_username': self.invitee.username,
            'recipient_email': self.invitee.email,
            'organization_name': self.invited_by.organization.name,
            'base_url': settings.KOBOFORM_URL,
        }

        email_message = EmailMessage(
            to=self.invited_by.email,
            subject='KoboToolbox organization invitation accepted',
            plain_text_content_or_template='emails/accepted_invite.txt',
            template_variables=template_variables,
            html_content_or_template='emails/accepted_invite.html',
            language=sender_language
        )

        Mailer.send(email_message)

    def send_invite_email(self):
        is_registered_user = bool(self.invitee)
        to_email = (
            self.invitee.email
            if is_registered_user
            else self.invitee_identifier
        )

        # Get recipient role with an article
        recipient_role = (
            t('an admin') if self.invitee_role == 'admin' else t('a member')
        )
        # To avoid circular import
        User = apps.get_model('kobo_auth', 'User')
        has_multiple_accounts = User.objects.filter(email=to_email).count() > 1
        organization_name = self.invited_by.organization.name
        current_language = settings.LANGUAGE_CODE
        invitee_language = (
            self.invitee.extra_details.data.get(
                'last_ui_language', current_language
            )
            if is_registered_user
            else current_language
        )

        template_variables = {
            'sender_name': self.invited_by.extra_details.data['name'],
            'sender_username': self.invited_by.username,
            'sender_email': self.invited_by.email,
            'recipient_username': (
                self.invitee.username
                if is_registered_user
                else self.invitee_identifier
            ),
            'recipient_email': to_email,
            'recipient_role': recipient_role,
            'organization_name': organization_name,
            'base_url': settings.KOBOFORM_URL,
            'invite_uid': self.guid,
            'is_registered_user': is_registered_user,
            'has_multiple_accounts': has_multiple_accounts,
        }

        if is_registered_user:
            html_template = 'emails/registered_user_invite.html'
            text_template = 'emails/registered_user_invite.txt'
        else:
            html_template = 'emails/unregistered_user_invite.html'
            text_template = 'emails/unregistered_user_invite.txt'

        with override(invitee_language):
            # Because `subject` contains a placeholder, it cannot be translated
            # by EmailMessage
            subject = replace_placeholders(
                t("You're invited to join ##organization_name## organization"),
                organization_name=organization_name
            )

        email_message = EmailMessage(
            to=to_email,
            subject=subject,
            plain_text_content_or_template=text_template,
            template_variables=template_variables,
            html_content_or_template=html_template,
            language=invitee_language,
        )

        Mailer.send(email_message)

    def send_refusal_email(self):
        """
        Send an email to the sender of the invitation to notify them that the
        invitee has declined the invitation
        """
        sender_language = self.invited_by.extra_details.data.get(
            'last_ui_language', settings.LANGUAGE_CODE
        )

        template_variables = {
            'sender_username': self.invited_by.username,
            'sender_email': self.invited_by.email,
            'recipient': (
                self.invitee.username
                if self.invitee
                else self.invitee_identifier
            ),
            'organization_name': self.invited_by.organization.name,
            'base_url': settings.KOBOFORM_URL,
        }

        email_message = EmailMessage(
            to=self.invited_by.email,
            subject='KoboToolbox organization invitation declined',
            plain_text_content_or_template='emails/declined_invite.txt',
            template_variables=template_variables,
            html_content_or_template='emails/declined_invite.html',
            language=sender_language,
        )

        Mailer.send(email_message)


create_organization = partial(create_organization_base, model=Organization)
