from typing import Union

import pytz
from dateutil.relativedelta import relativedelta
from django.utils import timezone

from kobo.apps.organizations.models import Organization


def organization_month_start(organization: Union[Organization, None]):
    now = timezone.now()
    first_of_this_month = now.date().replace(day=1)
    # If no organization/subscription, just use the first day of current month
    if not organization:
        return first_of_this_month
    if not (billing_details := organization.active_subscription_billing_details()):
        return first_of_this_month
    if not billing_details.get('billing_cycle_anchor'):
        return first_of_this_month

    # Subscription is billed monthly, use the current billing period start date
    if billing_details.get('recurring_interval') == 'month':
        return billing_details.get('current_period_start').replace(tzinfo=pytz.UTC)

    # Subscription is billed yearly - count backwards from the end of the current billing year
    month_start = billing_details.get('current_period_end').replace(tzinfo=pytz.UTC)
    while month_start > now:
        month_start -= relativedelta(months=1)
    return month_start


def organization_year_start(organization: Union[Organization, None]):
    now = timezone.now()
    first_of_this_year = now.date().replace(month=1, day=1)
    if not organization:
        return first_of_this_year
    if not (billing_details := organization.active_subscription_billing_details()):
        return first_of_this_year
    if not (anchor_date := billing_details.get('billing_cycle_anchor')):
        return first_of_this_year

    # Subscription is billed yearly, use the provided anchor date as start date
    if billing_details.get('subscription_interval') == 'year':
        return billing_details.get('current_period_start').replace(tzinfo=pytz.UTC)

    # Subscription is monthly, calculate this year's start based on anchor date
    while anchor_date + relativedelta(years=1) < now:
        anchor_date += relativedelta(years=1)
    return anchor_date.replace(tzinfo=pytz.UTC)
