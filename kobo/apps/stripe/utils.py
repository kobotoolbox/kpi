import calendar
from datetime import datetime
from math import ceil, floor, inf
from typing import Optional
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db.models import F, Max, Q, Window
from django.db.models.functions import Coalesce
from django.utils import timezone
from djstripe.models import Product

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


def get_active_subscription_billing_dates_by_org(
    organizations: list[Organization] = None,
):
    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
    first_of_next_month = first_of_this_month + relativedelta(months=1)
    orgs = Organization.objects.prefetch_related('djstripe_customers')
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
    all_active_plans = (
        orgs.filter(
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        )
        .values(
            org_id=F('id'),
            anchor=F('djstripe_customers__subscriptions__billing_cycle_anchor'),
            start=F('djstripe_customers__subscriptions__current_period_start'),
            end=F('djstripe_customers__subscriptions__current_period_end'),
            interval=F(
                'djstripe_customers__subscriptions__items__price__recurring__interval'  # noqa: E501
            ),
            start_date=F('djstripe_customers__subscriptions__start_date'),
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
    results = {}
    for res in all_active_plans:
        dates = {}
        if res['anchor'] is None:
            dates['start'] = first_of_this_month
            dates['end'] = first_of_next_month
        else:
            dates['start'] = res['start']
            dates['end'] = res['end']
        results[res['org_id']] = dates
    return results


def get_billing_dates_for_orgs_with_canceled_subscriptions(
    orgs: list[Organization] = None,
):
    all_orgs = Organization.objects.prefetch_related('djstripe_customers')
    if orgs is not None:
        all_orgs = all_orgs.filter(id__in=[org.id for org in orgs])
    all_cancellation_dates = (
        all_orgs.filter(
            djstripe_customers__subscriptions__status='canceled',
        )
        .values('id')
        .annotate(
            anchor=Max(F('djstripe_customers__subscriptions__ended_at')),
        )
    )
    result = {}
    for res in all_cancellation_dates:
        start, end = get_billing_dates_after_canceled_subscription(res['anchor'])
        result[res['id']] = {'start': start, 'end': end}

    return result


def get_organization_plan_limits(
    usage_type: UsageType, organizations: list[Organization] = None
):
    orgs = Organization.objects.prefetch_related('djstripe_customers')
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
    if not settings.STRIPE_ENABLED:
        return {org.id: inf for org in orgs}
    else:
        from djstripe.models.core import Product
    limit_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
    all_owner_plans = (
        orgs.filter(
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES
        )
        .values(
            org_id=F('id'),
            # prefer price metadata over product metadata
            limit=Coalesce(
                F(
                    f'djstripe_customers__subscriptions__items__price__metadata__{limit_key}'  # noqa
                ),
                F(
                    f'djstripe_customers__subscriptions__items__price__product__metadata__{limit_key}'  # noqa
                ),
            ),
            start_date=F('djstripe_customers__subscriptions__start_date'),
            product_type=F(
                'djstripe_customers__subscriptions__items__price__product__metadata__product_type'  # noqa
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
        res['org_id']: res['limit']
        for res in all_owner_plans
        if not (res['product_type'] == 'addon' and res['limit'] is None)
    }

    # Anyone who does not have a subscription is on the free tier plan by default
    default_plan = (
        Product.objects.filter(
            metadata__default_free_plan='true'
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

    return {org.id: get_limit(org) for org in orgs}


def get_default_plan_name() -> Optional[str]:
    default_plan = (
        Product.objects.filter(metadata__default_free_plan='true').values('').first()
    )
    if default_plan is not None:
        return default_plan.name


def get_organization_plan_limit(
    organization: Organization, usage_type: UsageType
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    return get_organization_plan_limits(usage_type, [organization]).get(organization.id)


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


def get_billing_dates_after_canceled_subscription(
    canceled_subscription_anchor: datetime,
):
    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    canceled_subscription_anchor = canceled_subscription_anchor.replace(
        tzinfo=ZoneInfo('UTC')
    )
    period_end = canceled_subscription_anchor
    # The goal below is to mimic Stripe's logic

    # > A monthly subscription with a billing cycle anchor date of January 31
    # > bills the last day of the month closest to the anchor date, so February 28
    # > (or February 29 in a leap year), then March 31, April 30, and so on.

    # Example: If a user cancels their plan on October 31,
    # the billing periods should be structured as follows:

    # | Month of Consultation | Billing Period   |
    # |-----------------------|------------------|
    # | November              | Oct 31 - Nov 30  |
    # | December              | Nov 30 - Dec 31  |
    # | January               | Dec 31 - Jan 31  |
    # | February              | Jan 31 - Feb 28  |
    # | March                 | Feb 28 - Mar 31  |
    # | April                 | Mar 31 - Apr 30  |
    # | May                   | Apr 30 - May 31  |
    # etc...
    cpt = 1
    while period_end < now:
        period_end = canceled_subscription_anchor + relativedelta(months=cpt)
        cpt += 1

    previous_month = period_end - relativedelta(months=1)
    last_day_of_previous_month = calendar.monthrange(
        previous_month.year, previous_month.month
    )[1]
    adjusted_start_day = min(
        canceled_subscription_anchor.day, last_day_of_previous_month
    )
    period_start = previous_month.replace(day=adjusted_start_day)

    # Avoid pushing billing cycle back to before cancellation date
    period_start = max(period_start, canceled_subscription_anchor)
    return period_start, period_end


def get_current_billing_period_dates_by_org(orgs: list[Organization] = None):

    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
    first_of_next_month = first_of_this_month + relativedelta(months=1)
    # check 1: look for active subscriptions
    all_active_billing_dates = get_active_subscription_billing_dates_by_org(orgs)

    results = {}
    already_seen = []
    remaining_orgs = []
    for org_id, dates in all_active_billing_dates.items():
        results[org_id] = dates
        already_seen.append(org_id)

    # check 2: look for canceled subscriptions
    if orgs is not None:
        # if we're only looking for a specific list of orgs and we already have
        # dates for all of them, return
        remaining_orgs = [org for org in orgs if org.id not in already_seen]
        if len(remaining_orgs) == 0:
            return results
        else:
            # only look for canceled subscriptions for orgs in the list
            # we didn't get active subs for
            all_canceled_billing_dates = (
                get_billing_dates_for_orgs_with_canceled_subscriptions(
                    orgs=remaining_orgs
                )
            )
    else:
        all_canceled_billing_dates = (
            get_billing_dates_for_orgs_with_canceled_subscriptions()
        )

    for org_id, dates in all_canceled_billing_dates.items():
        # prioritize active subscriptions over canceled ones
        results[org_id] = results.get(org_id) or dates
        already_seen.append(org_id)

    # default: beginning of this month and beginning of next month
    if orgs is not None:
        remaining_orgs = [org for org in remaining_orgs if org.id not in already_seen]
        for remaining_org in remaining_orgs:
            results[remaining_org.id] = {
                'start': first_of_this_month,
                'end': first_of_next_month,
            }
        return results

    for org in Organization.objects.filter(~Q(id__in=already_seen)):
        results[org.id] = {
            'start': first_of_this_month,
            'end': first_of_next_month,
        }
    return results
