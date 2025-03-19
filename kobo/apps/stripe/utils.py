import calendar
from datetime import datetime
from math import ceil, floor, inf
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db.models import F, Max, Q, Window
from django.db.models.functions import Coalesce
from django.utils import timezone

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
    """
    Retrieve the current billing cycle for provided organizations. Does not include
    the billing cycle for storage addons, as they are not measured monthly. If no
    list of organizations is provided, retrieves details for all organizations.
    """
    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
    first_of_next_month = first_of_this_month + relativedelta(months=1)
    orgs = Organization.objects.prefetch_related('djstripe_customers')
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
    all_active_plans = (
        orgs.filter(
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        ).exclude(
            djstripe_customers__subscriptions__items__price__product__metadata__product_type='addon',
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
        ).exclude(djstripe_customers__subscriptions__items__price__product__metadata__product_type='addon',)
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

def _get_limit_key(usage_type: UsageType):
    return f'{USAGE_LIMIT_MAP[usage_type]}_limit'

def _get_subscription_metadata_fields_for_usage_type(usage_type: UsageType):
    limit_key = _get_limit_key(usage_type)
    return f'items__price__metadata__{limit_key}', f'items__price__product__metadata__{limit_key}'

def _get_most_recent_storage_addon_limits(organizations: list[Organization]):
    """
    Return the most storage recurring addon limit and current billing period for
    every organization in organizations, if present (or all organizations with
    recurring storage addons if no list is provided)
    """
    orgs = Organization.objects.all()
    org_filter = Q()
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
        org_filter = Q(customer__subscriber_id__in=[org.id for org in orgs])
    from djstripe.models.billing import Subscription

    active_subscriptions = Subscription.objects.filter(
            org_filter
            & Q(status__in=ACTIVE_STRIPE_STATUSES)
            & Q(items__price__product__metadata__product_type='addon')
    )
    price_storage_key, product_storage_key = _get_subscription_metadata_fields_for_usage_type('storage')
    addons = (active_subscriptions.values(
        org_id=F('customer__subscriber_id'),
        storage_limit=Coalesce(F(price_storage_key), F(product_storage_key)),
        plan_start_date=F('start_date'),
    ).annotate(
        # find the most recent one
        most_recent=Window(
            expression=Max('plan_start_date'),
            partition_by=F('org_id'),
            order_by='org_id',
        )
    )
    .filter(
        Q(plan_start_date=F('most_recent'))
        | (Q(plan_start_date__isnull=True) & Q(most_recent__isnull=True))
    ))
    return addons


def _get_most_recent_subscription_limits(organizations: list[Organization] = None):
    """
    Return the most recent limits and current billing period for given organizations
    based on their most recent active plan (not counting addons), if a plan exists.
    If no organization list is provided, information will be fetched for all
    organizations with active plans.

    Makes the assumption that any product that isn't an addon or addon_onetime includes
    limits for all four usage types (storage, submissions, seconds, and characters)
    """
    if not settings.STRIPE_ENABLED:
        if organizations is not None:
            return {org.id: inf for org in organizations}
        else:
            return {org.id: inf for org in Organization.objects.all()}

    from djstripe.models.billing import Subscription

    orgs = Organization.objects.all()
    org_filter = Q()
    if organizations is not None:
        orgs = orgs.filter(id__in=[org.id for org in organizations])
        org_filter = Q(customer__subscriber_id__in=[org.id for org in orgs])

    price_storage_key, product_storage_key = _get_subscription_metadata_fields_for_usage_type('storage')
    price_submission_key, product_submission_key = _get_subscription_metadata_fields_for_usage_type('submission')
    price_characters_key, product_characters_key = _get_subscription_metadata_fields_for_usage_type('characters')
    price_seconds_key, product_seconds_key = _get_subscription_metadata_fields_for_usage_type('seconds')

    active_subscriptions = Subscription.objects.filter(
            org_filter
            & Q(status__in=ACTIVE_STRIPE_STATUSES)
    ).exclude(items__price__product__metadata__product_type='addon')

    most_recent_full_plans = (active_subscriptions
        .values(
            org_id=F('customer__subscriber_id'),
            storage_limit=Coalesce(F(price_storage_key), F(product_storage_key)),
            submission_limit=Coalesce(F(price_submission_key), F(product_submission_key)),
            seconds_limit=Coalesce(F(price_seconds_key), F(product_seconds_key)),
            characters_limit=Coalesce(F(price_characters_key), F(product_characters_key)),
            plan_start_date=F('start_date'),
        )
        .annotate(
            # find the most recent one
            most_recent=Window(
                expression=Max('plan_start_date'),
                partition_by=F('org_id'),
                order_by='org_id',
            )
        )
        .filter(
            Q(plan_start_date=F('most_recent'))
            | (Q(plan_start_date__isnull=True) & Q(most_recent__isnull=True))
        )
    )
    return most_recent_full_plans


def get_organization_plan_limits(organizations: list[Organization] = None, include_storage_addons=True):
    if not settings.STRIPE_ENABLED:
        if organizations is not None:
            return {org.id: inf for org in organizations}
        else:
            return {org.id: inf for org in Organization.objects.all()}

    from djstripe.models.core import Product

    orgs = Organization.objects.all()
    if organizations is not None:
        orgs = organizations
    all_org_ids = [org.id for org in orgs]

    plans_excluding_addons = _get_most_recent_subscription_limits(organizations)
    plans_excluding_addons_by_org = { row['org_id']: {
        f'{usage_type}_limit':  row[f'{usage_type}_limit'] for usage_type in ['characters', 'seconds', 'submission', 'storage']
    } for row in plans_excluding_addons}

    addon_plans = _get_most_recent_storage_addon_limits(organizations)
    addons_plans_by_org = { row['org_id']: {'storage_limit': row['storage_limit']} for row in addon_plans}

    storage_limit = _get_limit_key('storage')
    submission_limit = _get_limit_key('submission')
    characters_limit = _get_limit_key('characters')
    seconds_limit = _get_limit_key('seconds')
    # Anyone who does not have a subscription is on the free tier plan by default
    default_plan = (
        Product.objects.filter(
            metadata__default_free_plan='true'
        )
        .values(
            storage_limit=F(f'metadata__{storage_limit}'),
            submission_limit=F(f'metadata__{submission_limit}'),
            characters_limit=F(f'metadata__{characters_limit}'),
            seconds_limit=F(f'metadata__{seconds_limit}'),
        )
        .first()
    ) or {}
    default_plan_limits = {}
    for usage_type in ['characters', 'seconds', 'submission', 'storage']:
        limit_key = f'{usage_type}_limit'
        default_limit = default_plan.get(limit_key)
        if default_limit is None:
            default_plan_limits[limit_key] = "unlimited"
        else:
            default_plan_limits[limit_key] = default_limit


    results = {}
    for org_id in all_org_ids:
        all_org_limits = {}
        for usage_type in ['characters', 'seconds', 'submission', 'storage']:
            limit = plans_excluding_addons_by_org.get(org_id, {}).get(f'{usage_type}_limit')
            if limit is None:
                limit = default_plan_limits[f'{usage_type}_limit']
            if limit == "unlimited":
                limit = inf
            else:
                limit = int(limit)
            if usage_type == 'storage' and include_storage_addons:
                addon_limit = addons_plans_by_org.get(org_id, {}).get('storage_limit') or 0
                if addon_limit == "unlimited":
                    addon_limit = inf
                else:
                    addon_limit = int(addon_limit)
                if addon_limit > limit:
                    limit = addon_limit
            all_org_limits[f'{usage_type}_limit'] = limit
        results[org_id] = all_org_limits

    return results


def get_organization_plan_limit(
    organization: Organization, usage_type: UsageType
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    include_storage_addons = usage_type == 'storage'
    return get_organization_plan_limits([organization], include_storage_addons).get(organization.id, {}).get(f'{usage_type}_limit')


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
