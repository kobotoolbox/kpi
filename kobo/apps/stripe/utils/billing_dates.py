import calendar
from datetime import datetime
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.db.models import F, Max, Q, Window
from django.utils import timezone

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import BillingDates
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.utils.import_management import requires_stripe


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
