from typing import Literal

from dateutil.relativedelta import relativedelta
from django.utils import timezone
from djstripe.models import (
    Charge,
    Customer,
    PaymentIntent,
    Plan,
    Price,
    Product,
    Subscription,
    SubscriptionItem,
)
from model_bakery import baker

from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization


def generate_free_plan():
    product_metadata = {
        'product_type': 'plan',
        f'{UsageType.SUBMISSION}_limit': '5000',
        f'{UsageType.ASR_SECONDS}_limit': '600',
        f'{UsageType.MT_CHARACTERS}_limit': '6000',
        f'{UsageType.STORAGE_BYTES}_limit': '1000',
        'default_free_plan': 'true',
    }

    product = baker.make(Product, active=True, metadata=product_metadata)

    baker.make(
        Price,
        active=True,
        recurring={'interval': 'month'},
        unit_amount=0,
        product=product,
    )
    return product


def generate_plan_subscription(
    organization: Organization,
    metadata: dict = None,
    customer: Customer = None,
    interval: Literal['year', 'month'] = 'month',
    age_days: int = 0,
    price_metadata: dict = None,
    status: str = 'active',
) -> Subscription:
    """Create a subscription for a product with custom metadata"""
    created_date = timezone.now() - relativedelta(days=age_days)

    if not customer:
        customer = baker.make(Customer, subscriber=organization, livemode=False)
        organization.save()

    product_metadata = {
        'product_type': 'plan',
    }
    if metadata:
        product_metadata = {**product_metadata, **metadata}
    product = baker.make(Product, active=True, metadata=product_metadata)

    price = baker.make(
        Price,
        active=True,
        recurring={'interval': interval},
        product=product,
        metadata=price_metadata,
    )
    plan = baker.make(
        Plan, product=product, billing_scheme='per_unit', amount=1.0, currency='usd'
    )

    period_offset = relativedelta(weeks=2)

    if interval == 'year':
        period_offset = relativedelta(months=6)

    subscription_metadata = {
        'kpi_owner_username': organization.owner_user_object.username,
        'kpi_owner_user_id': organization.owner_user_object.id,
        'organization_id': organization.id,
    }

    subscription_item = baker.make(
        SubscriptionItem, price=price, quantity=1, livemode=False, plan=plan
    )
    return baker.make(
        Subscription,
        customer=customer,
        status=status,
        items=[subscription_item],
        livemode=False,
        billing_cycle_anchor=created_date - period_offset,
        current_period_end=created_date + period_offset,
        current_period_start=created_date - period_offset,
        start_date=created_date,
        plan=subscription_item.plan,
        metadata=subscription_metadata,
    )


def generate_mmo_subscription(organization: Organization, customer: Customer = None):
    product_metadata = {'mmo_enabled': 'true', 'plan_type': 'enterprise'}
    return generate_plan_subscription(organization, product_metadata, customer)


def _create_one_time_addon_product(limit_metadata=None):
    metadata = {
        'product_type': 'addon_onetime',
        'valid_tags': 'all',
        **(limit_metadata or {}),
    }
    product = baker.make(
        Product,
        active=True,
        metadata=metadata,
    )
    price = baker.make(Price, active=True, product=product, type='one_time')
    price.save()
    product.default_price = price
    product.save()
    return product


def _create_payment(
    customer, price, product, payment_status='succeeded', refunded=False
):
    payment_total = 2000
    payment_intent = baker.make(
        PaymentIntent,
        customer=customer,
        status=payment_status,
        payment_method_types=['card'],
        livemode=False,
        amount=payment_total,
        amount_capturable=payment_total,
        amount_received=payment_total,
    )
    charge = baker.prepare(
        Charge,
        customer=customer,
        refunded=refunded,
        created=timezone.now(),
        payment_intent=payment_intent,
        paid=True,
        status=payment_status,
        livemode=False,
        amount_refunded=0 if refunded else payment_total,
        amount=payment_total,
    )
    charge.metadata = {
        'price_id': price.id,
        'organization_id': customer.subscriber.id,
        **(product.metadata or {}),
    }
    charge.save()
    return charge


def _create_customer_from_org(organization: Organization):
    customer = baker.make(Customer, subscriber=organization, livemode=False)
    organization.save()
    return customer
