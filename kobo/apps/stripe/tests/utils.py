from dateutil.relativedelta import relativedelta
from django.utils import timezone
from djstripe.models import Customer, Product, SubscriptionItem, Subscription, Price
from model_bakery import baker

from kobo.apps.organizations.models import Organization


def generate_plan_subscription(
    organization: Organization, metadata: dict = None, customer: Customer = None
) -> Subscription:
    """Create a subscription for a product with custom metadata"""
    now = timezone.now()

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
        id='price_sfmOFe33rfsfd36685657',
        product=product,
    )

    subscription_item = baker.make(SubscriptionItem, price=price, quantity=1, livemode=False)
    return baker.make(
        Subscription,
        customer=customer,
        status='active',
        items=[subscription_item],
        livemode=False,
        billing_cycle_anchor=now - relativedelta(weeks=2),
        current_period_end=now + relativedelta(weeks=2),
        current_period_start=now - relativedelta(weeks=2),
    )


def generate_enterprise_subscription(organization: Organization, customer: Customer = None):
    return generate_plan_subscription(organization, {'plan_type': 'enterprise'}, customer)
