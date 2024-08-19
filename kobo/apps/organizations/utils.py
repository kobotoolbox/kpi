from typing import Union

import pytz
from datetime import datetime
from dateutil.relativedelta import relativedelta
from django.utils import timezone

from kobo.apps.organizations.models import Organization


def get_monthly_billing_dates(organization: Union[Organization, None]):
    """Returns start and end dates of an organization's monthly billing cycle"""

    now = timezone.now().replace(tzinfo=pytz.UTC)
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=pytz.UTC)
    first_of_next_month = (
        first_of_this_month
        + relativedelta(months=1)
    )

    # If no organization, just use the calendar month
    if not organization:
        return first_of_this_month, first_of_next_month
    
    # If no active subscription, check for canceled subscription 
    if not (billing_details := organization.active_subscription_billing_details()):
        if not (
            canceled_subscription_anchor
            := organization.canceled_subscription_billing_cycle_anchor()
        ):
            return first_of_this_month, first_of_next_month
        
        period_end = canceled_subscription_anchor.replace(tzinfo=pytz.UTC)
        while period_end < now:
            period_end += relativedelta(months=1)
        period_start = period_end - relativedelta(months=1)
        return period_start, period_end
    
    if not billing_details.get('billing_cycle_anchor'):
        return first_of_this_month, first_of_next_month

    # Subscription is billed monthly, use the current billing period dates
    if billing_details.get('recurring_interval') == 'month':
        period_start = billing_details.get('current_period_start').replace(
            tzinfo=pytz.UTC
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=pytz.UTC
        )
        return period_start, period_end

    # Subscription is billed yearly - count backwards from the end of the current billing year
    period_start = billing_details.get('current_period_end').replace(tzinfo=pytz.UTC)
    while period_start > now:
        period_start -= relativedelta(months=1)
    period_end = period_start + relativedelta(months=1)
    return period_start, period_end


def get_yearly_billing_dates(organization: Union[Organization, None]):
    """Returns start and end dates of an organization's annual billing cycle"""
    now = timezone.now().replace(tzinfo=pytz.UTC)
    first_of_this_year = datetime(now.year, 1, 1, tzinfo=pytz.UTC)
    first_of_next_year = first_of_this_year + relativedelta(years=1)

    if not organization:
        return first_of_this_year, first_of_next_year
    if not (billing_details := organization.active_subscription_billing_details()):
        return first_of_this_year, first_of_next_year
    if not (anchor_date := billing_details.get('billing_cycle_anchor')):
        return first_of_this_year, first_of_next_year

    # Subscription is billed yearly, use the dates from the subscription
    if billing_details.get('recurring_interval') == 'year':
        period_start = billing_details.get('current_period_start').replace(
            tzinfo=pytz.UTC
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=pytz.UTC
        )
        return period_start, period_end

    # Subscription is monthly, calculate this year's start based on anchor date
    period_start = anchor_date.replace(tzinfo=pytz.UTC) + relativedelta(years=1)
    while period_start < now:
        anchor_date += relativedelta(years=1)
    period_end = period_start + relativedelta(years=1)
    return period_start, period_end
