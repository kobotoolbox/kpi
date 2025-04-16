import calendar
import functools
from datetime import datetime
from math import ceil, floor, inf
from typing import Optional, get_args
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.apps import apps
from django.conf import settings
from django.db.models import F, Max, Q, QuerySet, Window
from django.db.models.functions import Coalesce
from django.utils import timezone

from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.organizations.types import BillingDates, UsageLimits, UsageType
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES, USAGE_LIMIT_MAP


def requires_stripe(func):
    """
    Decorator for methods that rely either on models from Stripe packages or
    stripe-related database fields

    Any method that calls a @requires_stripe-decorated method should either be
    decorated itself, or enclose the method in an if settings.STRIPE_ENABLED block
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not settings.STRIPE_ENABLED:
            raise NotImplementedError(
                f'Cannot call {func.__name__} with stripe disabled'
            )
        else:
            from djstripe.models import (
                Charge,
                PaymentIntent,
                Price,
                Product,
                Subscription,
            )

            PlanAddOn = apps.get_model('stripe', 'PlanAddOn')

            kwargs['product_model'] = Product
            kwargs['subscription_model'] = Subscription
            kwargs['price_model'] = Price
            kwargs['charge_model'] = Charge
            kwargs['payment_intent_model'] = PaymentIntent
            kwargs['plan_add_on_model'] = PlanAddOn

            return func(*args, **kwargs)

    return wrapper


def _get_default_usage_limits():
    return {f'{usage_type}_limit': inf for usage_type in get_args(UsageType)}


def _get_limit_key(usage_type: UsageType):
    return f'{USAGE_LIMIT_MAP[usage_type]}_limit'


def _get_subscription_metadata_fields_for_usage_type(usage_type: UsageType):
    limit_key = _get_limit_key(usage_type)
    return (
        f'items__price__metadata__{limit_key}',
        f'items__price__product__metadata__{limit_key}',
    )


@requires_stripe
def get_default_plan_name(**kwargs) -> Optional[str]:
    Product = kwargs['product_model']
    default_plan = (
        Product
        .objects.filter(metadata__default_free_plan='true')
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
def get_current_billing_period_dates_by_org(
    orgs: list[Organization] = None, **kwargs
) -> dict[str, BillingDates]:

    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
    first_of_next_month = first_of_this_month + relativedelta(months=1)

    # check 1: look for active subscriptions
    all_active_billing_dates = get_current_billing_period_dates_for_active_plans(orgs)

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
                get_current_billing_period_dates_based_on_canceled_plans(
                    orgs=remaining_orgs
                )
            )
    else:
        all_canceled_billing_dates = (
            get_current_billing_period_dates_based_on_canceled_plans()
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


@requires_stripe
def get_current_billing_period_dates_based_on_canceled_plans(
    orgs: list[Organization] = None, **kwargs
) -> dict[str, BillingDates]:
    """
    Retrieve the current billing cycle based on the most recent canceled plan for
    the provided organizations (not including addons). If no list of organizations is
    provided, returns details for all canceled plans.

    Example return dict:
    {
        'org1': {
            'start': datetime(2025,01,10,..., UTC),
            'end': datetime(2026,01,10,...,UTC),
        }
        ...
    }
    """
    all_orgs = Organization.objects.prefetch_related('djstripe_customers')
    if orgs is not None:
        all_orgs = all_orgs.filter(id__in=[org.id for org in orgs])
    all_cancellation_dates = (
        all_orgs.filter(
            djstripe_customers__subscriptions__status='canceled',
            djstripe_customers__subscriptions__items__price__product__metadata__product_type='plan',  # noqa
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


@requires_stripe
def get_billing_dates_after_canceled_subscription(
    canceled_subscription_anchor: datetime, **kwargs
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


@requires_stripe
def get_current_billing_period_dates_for_active_plans(
    organizations: list[Organization] = None, **kwargs
) -> dict[str, dict[str, datetime]]:
    """
    Retrieve the current billing cycle for the most recent active plan for
    the provided organizations (not including addons). If no list of organizations is
    provided, returns details for all active plans.

    Example return dict:
    {
        'org1': {
            'start': datetime(2025,01,10,..., UTC),
            'end': datetime(2026,01,10,...,UTC),
        }
        ...
    }
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
            djstripe_customers__subscriptions__items__price__product__metadata__product_type='plan',  # noqa
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


def get_default_add_on_limits():
    return {
        'submission_limit': 0,
        'asr_seconds_limit': 0,
        'mt_characters_limit': 0,
    }


@requires_stripe
def get_organization_subscription_limit(
    organization: Organization, usage_type: UsageType, **kwargs
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    include_storage_addons = usage_type == 'storage'
    return (
        get_organizations_subscription_limits([organization], include_storage_addons)
        .get(organization.id, {})
        .get(f'{usage_type}_limit')
    )


@requires_stripe
def get_organizations_subscription_limits(
    organizations: list[Organization] = None,
    include_storage_addons: bool = True,
    **kwargs,
) -> dict[str, UsageLimits]:
    """
    Return the all usage limits for given organizations based on their recurring
    subscriptions.

    To determine an organization's limits:
    1. Get the most recent active plans and storage addons
    2. If there is an active plan, set the limits to the limits of the plan
    3. If there is no active plan, set the limits to the limits of the default plan
    4. If there is a storage addon, update the storage limit to
     max(storage addon, existing limit)

    Example result:
    { 'org1':
        {
            'storage_limit': inf,
            'submission_limit': 5000,
            'characters_limit': 72000,
            'seconds_limit': 6000,
        },
        ...
    }

    :param organizations: List of organizations to use. Gets all orgs if not provided.
    :param include_storage_addons: bool. Include storage addons in the calculation
    """
    Product = kwargs['product_model']

    # determine which orgs we care about and get their ids
    if organizations is not None:
        orgs = organizations
    else:
        orgs = Organization.objects.all()
    all_org_ids = [org.id for org in orgs]

    # get paid subscription limits
    subscription_limits = get_paid_subscription_limits(all_org_ids)
    subscription_limits_by_org_id = {}
    for row in subscription_limits:
        row_limits = subscription_limits_by_org_id.get(row['org_id'], {})
        if row['product_type'] == 'plan':
            row_limits = {
                f'{usage_type}_limit': row[f'{usage_type}_limit']
                for usage_type in get_args(UsageType)
            }
        elif row['product_type'] == 'addon':
            row_limits['addon_storage_limit'] = row['storage_limit']
        subscription_limits_by_org_id[row['org_id']] = row_limits

    storage_limit = _get_limit_key('storage')
    submission_limit = _get_limit_key('submission')
    characters_limit = _get_limit_key('characters')
    seconds_limit = _get_limit_key('seconds')
    # Anyone who does not have a subscription is on the free tier plan by default
    default_plan = (
        Product
        .objects.filter(metadata__default_free_plan='true')
        .values(
            storage_limit=F(f'metadata__{storage_limit}'),
            submission_limit=F(f'metadata__{submission_limit}'),
            characters_limit=F(f'metadata__{characters_limit}'),
            seconds_limit=F(f'metadata__{seconds_limit}'),
        )
        .first()
    ) or {}
    default_plan_limits = {}
    for usage_type in get_args(UsageType):
        limit_key = f'{usage_type}_limit'
        default_limit = default_plan.get(limit_key)
        if default_limit is None:
            default_plan_limits[limit_key] = 'unlimited'
        else:
            default_plan_limits[limit_key] = default_limit

    results = {}
    for org_id in all_org_ids:
        all_org_limits = {}
        for usage_type in get_args(UsageType):
            plan_limit = subscription_limits_by_org_id.get(org_id, {}).get(
                f'{usage_type}_limit'
            )
            addon_limit = subscription_limits_by_org_id.get(org_id, {}).get(
                'addon_storage_limit'
            )
            default_limit = default_plan_limits[f'{usage_type}_limit']
            limit = determine_limit(
                usage_type,
                plan_limit,
                addon_limit,
                default_limit,
                include_storage_addons,
            )
            all_org_limits[f'{usage_type}_limit'] = limit
        results[org_id] = all_org_limits

    return results


def get_organizations_effective_limits(
    organizations: list[Organization] = None,
    include_storage_addons=True,
    include_onetime_addons=True,
) -> dict[str, UsageLimits]:
    """
    Return the all usage limits for given organizations based on their recurring
    subscriptions and one-time addons. If Stripe is not enabled, returns inf for
    all limits.

    Example result:
    { 'org1':
        {
            'storage_limit': inf,
            'submission_limit': 5000,
            'characters_limit': 72000,
            'seconds_limit': 6000,
        },
        ...
    }

    :param organizations: List of organizations to use. Gets all orgs if not provided.
    :param include_storage_addons: bool. Include storage addons in the calculation
    :param include_onetime_addons: bool. Include onetime addons in the calculation
    """

    if not settings.STRIPE_ENABLED:
        orgs = organizations or Organization.objects.all()
        return {org.id: _get_default_usage_limits() for org in orgs}

    effective_limits = get_organizations_subscription_limits(
        include_storage_addons=include_storage_addons, organizations=organizations
    )
    if include_onetime_addons:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        addon_limits = PlanAddOn.get_organizations_totals(organizations=organizations)
        for org_id, limits in effective_limits.items():
            for usage_type in get_args(UsageType):
                addon = addon_limits.get(org_id, {}).get(f'total_{usage_type}_limit', 0)
                limits[f'{usage_type}_limit'] += addon
    return effective_limits


@requires_stripe
def get_paid_subscription_limits(organization_ids: list[str], **kwargs) -> QuerySet:
    """
    Return the most recent limits for all usage types for given organizations based on
    their most recent subscriptions. If they have both a regular plan and an addon,
    returns a row for both. If no organization list is provided, information will be
    fetched for all subscriptions.

    Only works when Stripe is enabled.
    """
    Subscription = kwargs['subscription_model']

    price_storage_key, product_storage_key = (
        _get_subscription_metadata_fields_for_usage_type('storage')
    )
    price_submission_key, product_submission_key = (
        _get_subscription_metadata_fields_for_usage_type('submission')
    )
    price_characters_key, product_characters_key = (
        _get_subscription_metadata_fields_for_usage_type('characters')
    )
    price_seconds_key, product_seconds_key = (
        _get_subscription_metadata_fields_for_usage_type('seconds')
    )

    # Get organizations we care about (either those in the 'organizations' param or all)
    org_filter = Q(customer__subscriber_id__in=[org_id for org_id in organization_ids])

    active_subscriptions = Subscription.objects.filter(
        org_filter
        & Q(status__in=ACTIVE_STRIPE_STATUSES)
        & Q(items__price__product__metadata__product_type__in=['plan', 'addon'])
    )

    most_recent_subs = (
        active_subscriptions.values(
            org_id=F('customer__subscriber_id'),
            storage_limit=Coalesce(F(price_storage_key), F(product_storage_key)),
            submission_limit=Coalesce(
                F(price_submission_key), F(product_submission_key)
            ),
            seconds_limit=Coalesce(F(price_seconds_key), F(product_seconds_key)),
            characters_limit=Coalesce(
                F(price_characters_key), F(product_characters_key)
            ),
            sub_start_date=F('start_date'),
            product_type=F('items__price__product__metadata__product_type'),
        )
        .annotate(
            # find the most recent one
            most_recent_plan=Window(
                expression=Max('sub_start_date', filter=Q(product_type='plan')),
                partition_by=F('org_id'),
                order_by='org_id',
            ),
            most_recent_addon=Window(
                expression=Max('sub_start_date', filter=Q(product_type='addon')),
                partition_by=F('org_id'),
                order_by='org_id',
            )
        )
        .filter(
            # most recent full plan
            (Q(sub_start_date=F('most_recent_plan')) & Q(product_type='plan'))
            # most recent addon
            | (Q(sub_start_date=F('most_recent_addon')) & Q(product_type='addon'))
            # handle dates being null
            | (
                Q(sub_start_date__isnull=True)
                & Q(most_recent_addon__isnull=True)
                & Q(product_type='plan')
            )
            | (
                Q(sub_start_date__isnull=True)
                & Q(most_recent_addon__isnull=True)
                & Q(product_type='addon')
            )
        )
    )
    return most_recent_subs


def determine_limit(
    usage_type: UsageType,
    plan_limit,
    addon_limit,
    default_limit,
    include_storage_addons,
) -> float:
    # 1. do we have a regular subscription plan?
    limit = plan_limit or default_limit or inf
    # "unlimited" -> inf
    if limit == 'unlimited':
        limit = inf
    # convert string to int
    else:
        limit = float(limit)

    # for storage, factor in addons if specified
    if usage_type == 'storage' and include_storage_addons:
        if addon_limit == 'unlimited':
            addon_limit = inf
        else:
            addon_limit = int(addon_limit or 0)
        # take the max of the addon limit and the previously-calculated limit
        if addon_limit > limit:
            limit = addon_limit
    return limit


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

    plan_name = ' and '.join([plan.product.name for plan in unique_plans])
    if plan_name is None or plan_name == '':
        plan_name = get_default_plan_name()
    return plan_name
