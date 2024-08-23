from typing import Literal

from dateutil.relativedelta import relativedelta
from django.utils import timezone
from djstripe.models import Customer, Product, SubscriptionItem, Subscription, Price
from model_bakery import baker

from kobo.apps.organizations.models import Organization


def generate_plan_subscription(
    organization: Organization,
    metadata: dict = None,
    customer: Customer = None,
    interval: Literal['year', 'month'] = 'month',
    age_days: int = 0,
) -> Subscription:
    """Create a subscription for a product with custom metadata"""
    created_date = timezone.now() - relativedelta(days=age_days)
    price_id = 'price_sfmOFe33rfsfd36685657'

    if not customer:
        customer = baker.make(Customer, subscriber=organization, livemode=False)
        organization.save()

    product_metadata = {
        'product_type': 'plan',
    }
    if metadata:
        product_metadata = {**product_metadata, **metadata}
    product = baker.make(Product, active=True, metadata=product_metadata)

    if not (price := Price.objects.filter(id=price_id).first()):
        price = baker.make(
            Price,
            active=True,
            id=price_id,
            recurring={'interval': interval},
            product=product,
        )

    period_offset = relativedelta(weeks=2)

    if interval == 'year':
        period_offset = relativedelta(months=6)

    subscription_item = baker.make(
        SubscriptionItem, price=price, quantity=1, livemode=False
    )
    return baker.make(
        Subscription,
        customer=customer,
        status='active',
        items=[subscription_item],
        livemode=False,
        billing_cycle_anchor=created_date - period_offset,
        current_period_end=created_date + period_offset,
        current_period_start=created_date - period_offset,
    )


def generate_enterprise_subscription(organization: Organization, customer: Customer = None):
    return generate_plan_subscription(organization, {'plan_type': 'enterprise'}, customer)
