from math import ceil, floor
from typing import Optional

from django.conf import settings

from kobo.apps.organizations.models import OrganizationUser
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.utils.import_management import requires_stripe


@requires_stripe
def get_default_plan_name(**kwargs) -> Optional[str]:
    Product = kwargs['product_model']
    default_plan = (
        Product.objects.filter(metadata__default_free_plan='true')
        .values('name')
        .first()
    )
    if default_plan is not None:
        return default_plan['name']


def generate_return_url(product_metadata):
    """
    Determine which frontend page Stripe should redirect users to
    after they make a purchase or manage their account.
    """
    base_url = settings.KOBOFORM_URL + '/#/account/'
    return_page = 'addons' if product_metadata['product_type'] == 'addon' else 'plan'
    return base_url + return_page


@requires_stripe
def get_total_price_for_quantity(
    price: 'djstripe.models.Price', quantity: int, **kwargs
):
    """
    Calculate a total price (dividing and rounding as necessary) for an item quantity
    and djstripe Price object
    """
    total_price = quantity
    if price.transform_quantity:
        total_price = total_price / price.transform_quantity['divide_by']
        if price.transform_quantity['round'] == 'up':
            total_price = ceil(total_price)
        else:
            total_price = floor(total_price)
    return total_price * price.unit_amount


@requires_stripe
def get_plan_name(org_user: OrganizationUser, **kwargs) -> str | None:
    Subscription = kwargs['subscription_model']
    subscriptions = Subscription.objects.filter(
        customer__subscriber_id=org_user.organization.id,
        status__in=ACTIVE_STRIPE_STATUSES,
    )

    unique_plans = set()
    for subscription in subscriptions:
        unique_plans.add(subscription.plan)

    # Make sure plans come before addons
    plan_list = sorted(
        unique_plans,
        key=lambda plan: plan.product.metadata.get('product_type', '') == 'plan',
        reverse=True,
    )
    plan_name = ' and '.join([plan.product.name for plan in plan_list])
    if plan_name is None or plan_name == '':
        plan_name = get_default_plan_name()
    return plan_name
