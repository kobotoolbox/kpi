from datetime import datetime
from typing import Union

from dateutil.relativedelta import relativedelta
from django.apps import apps
from django.utils import timezone
from zoneinfo import ZoneInfo

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.models.object_permission import ObjectPermission


def get_billing_dates(organization: Union['Organization', None]):
    """Returns start and end dates of an organization's billing cycle."""

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

    if billing_details.get('recurring_interval') == 'month':
        period_start = billing_details.get('current_period_start').replace(
            tzinfo=ZoneInfo('UTC')
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=ZoneInfo('UTC')
        )
        return period_start, period_end

    if billing_details.get('recurring_interval') == 'year':
        period_start = billing_details.get('current_period_start').replace(
            tzinfo=ZoneInfo('UTC')
        )
        period_end = billing_details.get('current_period_end').replace(
            tzinfo=ZoneInfo('UTC')
        )
        return period_start, period_end

    return first_of_this_month, first_of_next_month


def get_real_owner(user: User) -> User:
    organization = user.organization
    if organization.is_mmo:
        return organization.owner_user_object
    return user


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
