from math import ceil, floor, inf

from django.conf import settings
from django.db.models import F, Max, Q, Window
from django.db.models.functions import Coalesce

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES, USAGE_LIMIT_MAP


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


def get_organization_plan_limits(
    usage_type: UsageType, organizations: list[Organization] = None
):
    orgs = Organization.objects.prefetch_related('djstripe_customers')
    limit_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
    all_owner_plans = (
        orgs.filter(
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES
        )
        .values(
            org_id=F('id'),
            # prefer price metadata over product metadata
            limit=Coalesce(
                F(
                    f'djstripe_customers__subscriptions__items__price__metadata__{limit_key}'
                ),
                F(
                    f'djstripe_customers__subscriptions__items__price__product__metadata__{limit_key}'
                ),
            ),
            start_date=F('djstripe_customers__subscriptions__start_date'),
            product_type=F(
                'djstripe_customers__subscriptions__items__price__product__metadata__product_type'
            ),
        )
        .annotate(
            # find the most recent one
            most_recent=Window(
                expression=Max('start_date'),
                partition_by=F('org_id'),
                order_by='org_id',
            )
        )
        .filter(
            Q(start_date=F('most_recent'))
            | (Q(start_date__isnull=True) & Q(most_recent__isnull=True))
        )
    )
    subscriptions = {
        res['org_id']:  res['limit']
        for res in all_owner_plans if not (res['product_type'] == 'addon' and res['limit'] is None)
    }
    from djstripe.models.core import Product

    # Anyone who does not have a subscription is on the free tier plan by default
    default_plan = (
        Product.objects.filter(
            prices__unit_amount=0, prices__recurring__interval='month'
        )
        .values(limit=F(f'metadata__{limit_key}'))
        .first()
    )
    default_limit = default_plan['limit'] if default_plan else 'unlimited'

    def get_limit(org):
        limit = subscriptions.get(org.id, default_limit)
        if limit == 'unlimited':
            limit = inf
        else:
            limit = int(limit)
        return limit

    return { org.id: get_limit(org) for org in organizations}


def get_organization_plan_limit(
    organization: Organization, usage_type: UsageType
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    return get_organization_plan_limits(usage_type, [organization])[organization.id]


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
