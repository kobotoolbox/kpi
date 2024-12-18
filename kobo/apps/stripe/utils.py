from math import ceil, floor, inf

from django.conf import settings
from django.db.models import F

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP


def generate_return_url(product_metadata):
    """
    Determine which frontend page Stripe should redirect users to
    after they make a purchase or manage their account.
    """
    base_url = settings.KOBOFORM_URL + '/#/account/'
    return_page = 'addons' if product_metadata['product_type'] == 'addon' else 'plan'
    return base_url + return_page


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


def get_organization_plan_limit(
    organization: Organization, usage_type: UsageType
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    if not settings.STRIPE_ENABLED:
        return inf

    limit_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'

    relevant_limit = None
    if subscription := organization.active_subscription_billing_details():
        price_metadata = subscription['price_metadata']
        product_metadata = subscription['product_metadata']
        price_limit = price_metadata[limit_key] if price_metadata else None
        product_limit = product_metadata[limit_key] if product_metadata else None
        relevant_limit = price_limit or product_limit
    else:
        from djstripe.models.core import Product

        # Anyone who does not have a subscription is on the free tier plan by default
        default_plan = (
            Product.objects.filter(
                prices__unit_amount=0, prices__recurring__interval='month'
            )
            .values(limit=F(f'metadata__{limit_key}'))
            .first()
        )

        if default_plan:
            relevant_limit = default_plan['limit']

    if relevant_limit == 'unlimited':
        return inf

    if relevant_limit:
        return int(relevant_limit)

    return inf


def get_total_price_for_quantity(price: 'djstripe.models.Price', quantity: int):
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
