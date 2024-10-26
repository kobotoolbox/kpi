from math import ceil, floor

from django.conf import settings
from django.db.models import F

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES, USAGE_LIMIT_MAP_STRIPE


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


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

def generate_return_url(product_metadata):
    """
    Determine which frontend page Stripe should redirect users to
    after they make a purchase or manage their account.
    """
    base_url = settings.KOBOFORM_URL + '/#/account/'
    return_page = (
        'addons' if product_metadata['product_type'] == 'addon' else 'plan'
    )
    return base_url + return_page


def get_organization_plan_limit(
    organization: Organization, usage_type: UsageType
) -> int:
    """
    Get organization plan limit for a given usage type
    """
    if not settings.STRIPE_ENABLED:
        return None
    stripe_key = f'{USAGE_LIMIT_MAP_STRIPE[usage_type]}_limit'
    query_product_type = (
        'djstripe_customers__subscriptions__items__price__'
        'product__metadata__product_type'
    )
    query_status__in = 'djstripe_customers__subscriptions__status__in'
    organization_filter = Organization.objects.filter(
        id=organization.id,
        **{
            query_status__in: ACTIVE_STRIPE_STATUSES,
            query_product_type: 'plan',
        }
    )

    field_price_limit = (
        'djstripe_customers__subscriptions__items__'
        f'price__metadata__{stripe_key}'
    )
    field_product_limit = (
        'djstripe_customers__subscriptions__items__'
        f'price__product__metadata__{stripe_key}'
    )
    current_limit = (
        organization_filter.values(
            price_limit=F(field_price_limit),
            product_limit=F(field_product_limit),
            prod_metadata=F(
                'djstripe_customers__subscriptions__items__price__product__metadata'
            ),
        )
        .first()
    )
    relevant_limit = None
    if current_limit is not None:
        relevant_limit = current_limit.get('price_limit') or current_limit.get(
            'product_limit'
        )
    if relevant_limit is None:
        # TODO: get the limits from the community plan, overrides
        relevant_limit = 2000

    return relevant_limit
