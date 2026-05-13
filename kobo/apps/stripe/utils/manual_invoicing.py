import stripe
from django.conf import settings
from djstripe.models import Customer, Price, Subscription
from djstripe.settings import djstripe_settings

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.exceptions import (
    DefaultCommunityPlanNotFoundError,
    ManualInvoicingSetupError,
    ManualInvoicingSubscriptionExistsError,
)


def get_default_community_plan_price() -> Price:
    price = (
        Price.objects.filter(
            active=True,
            unit_amount=0,
            recurring__interval='month',
            product__active=True,
            product__metadata__default_free_plan='true',
            product__metadata__product_type='plan',
        )
        .order_by('id')
        .first()
    )
    if price is None:
        raise DefaultCommunityPlanNotFoundError(
            'No active free community plan price is configured in Stripe.'
        )
    return price


def organization_can_start_manual_invoicing(organization) -> bool:
    return not bool(organization.active_subscription_billing_details())


def create_manual_invoicing_subscription(organization) -> Subscription:
    """
    Bootstrap manual invoicing by creating a free community subscription in Stripe

    This intentionally does not use `transaction.atomic()`, the critical side effects
    are remote Stripe API calls, which cannot be rolled back by a database
    transaction.
    """
    if not organization_can_start_manual_invoicing(organization):
        raise ManualInvoicingSubscriptionExistsError(
            'Organization already has an active Stripe subscription.'
        )

    try:
        owner = organization.owner_user_object
    except AttributeError as err:
        raise ManualInvoicingSetupError(
            'Organization must have an owner before manual invoicing can start.'
        ) from err

    price = get_default_community_plan_price()
    stripe.api_key = djstripe_settings.STRIPE_SECRET_KEY

    customer, _ = Customer.get_or_create(
        subscriber=organization,
        livemode=price.livemode,
    )
    stripe_customer = stripe.Customer.modify(
        customer.id,
        name=customer.name or organization.name,
        email=owner.email,
        description=organization.name,
        metadata={
            'kpi_owner_username': owner.username,
            'kpi_owner_user_id': owner.id,
            'organization_id': organization.id,
            'manual_invoicing': 'true',
            'request_url': settings.KOBOFORM_URL,
        },
    )
    customer.sync_from_stripe_data(stripe_customer)

    # Re-check against Stripe directly before creating the subscription. This is
    # a safety net for cases where local dj-stripe data is stale or webhooks have
    # not synced yet
    existing_subscriptions = stripe.Subscription.list(
        customer=customer.id,
        status='all',
        limit=100,
    )
    for stripe_subscription in existing_subscriptions.auto_paging_iter():
        if stripe_subscription.status in ACTIVE_STRIPE_STATUSES:
            Subscription.sync_from_stripe_data(stripe_subscription)
            raise ManualInvoicingSubscriptionExistsError(
                'Organization already has an active Stripe subscription.'
            )

    stripe_subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{'price': price.id}],
        metadata={
            'kpi_owner_username': owner.username,
            'kpi_owner_user_id': owner.id,
            'organization_id': organization.id,
            'manual_invoicing': 'true',
            'request_url': settings.KOBOFORM_URL,
        },
    )
    return Subscription.sync_from_stripe_data(stripe_subscription)
