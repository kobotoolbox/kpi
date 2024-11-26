from datetime import datetime
from typing import Union

from dateutil.relativedelta import relativedelta
from django.apps import apps
from django.utils import timezone
from zoneinfo import ZoneInfo

from kobo.apps.organizations.models import Organization
from kpi.models.object_permission import ObjectPermission


def get_monthly_billing_dates(organization: Union['Organization', None]):
    """Returns start and end dates of an organization's monthly billing cycle"""

    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
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

        canceled_subscription_anchor = canceled_subscription_anchor.replace(
            tzinfo=ZoneInfo('UTC')
        )
        period_end = canceled_subscription_anchor
        while period_end < now:
            period_end += relativedelta(months=1)
        # Avoid pushing billing cycle back to before cancelation date
        period_start = max(
            period_end - relativedelta(months=1),
            canceled_subscription_anchor,
        )
        return period_start, period_end

    if not billing_details.get('billing_cycle_anchor'):
        return first_of_this_month, first_of_next_month

    # Subscription is billed monthly, use the current billing period dates
    if billing_details.get('recurring_interval') == 'month':
        period_start = billing_details.get('current_period_start').replace(
            tzinfo=ZoneInfo('UTC')
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=ZoneInfo('UTC')
        )
        return period_start, period_end

    # Subscription is billed yearly - count backwards from the end of the
    # current billing year
    period_start = billing_details.get('current_period_end').replace(
        tzinfo=ZoneInfo('UTC')
    )
    while period_start > now:
        period_start -= relativedelta(months=1)
    period_end = period_start + relativedelta(months=1)
    return period_start, period_end


def get_yearly_billing_dates(organization: Union['Organization', None]):
    """Returns start and end dates of an organization's annual billing cycle"""
    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_year = datetime(now.year, 1, 1, tzinfo=ZoneInfo('UTC'))
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
            tzinfo=ZoneInfo('UTC')
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=ZoneInfo('UTC')
        )
        return period_start, period_end

    # Subscription is monthly, calculate this year's start based on anchor date
    period_start = anchor_date.replace(tzinfo=ZoneInfo('UTC')) + relativedelta(years=1)
    while period_start < now:
        anchor_date += relativedelta(years=1)
    period_end = period_start + relativedelta(years=1)
    return period_start, period_end


def revoke_org_asset_perms(organization: Organization, user_ids: list[int]):
    """
    Revokes permissions assigned to removed members on all assets belonging to
    the organization.
    """
    Asset = apps.get_model('kpi', 'Asset')  # noqa
    subquery = Asset.objects.values_list('pk', flat=True).filter(
        owner=organization.owner_user_object
    )
    ObjectPermission.objects.filter(
        asset_id__in=subquery, user_id__in=user_ids
    ).delete()
