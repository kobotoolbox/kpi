from datetime import datetime
from typing import Union
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from django.apps import apps
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kpi.models.object_permission import ObjectPermission


def get_billing_dates(organization: Union['Organization', None]):
    """Returns start and end dates of an organization's current billing cycle."""
    now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
    first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
    first_of_next_month = (
        first_of_this_month
        + relativedelta(months=1)
    )
    if not organization or not settings.STRIPE_ENABLED:
        return first_of_this_month, first_of_next_month
    calculated_dates = get_current_billing_period_dates_by_org([organization]).get(
        organization.id
    )
    if calculated_dates is None:
        return first_of_this_month, first_of_next_month
    else:
        return calculated_dates['start'], calculated_dates['end']


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
    owner_id = organization.owner_user_object.pk

    # Filter out the owner from user_ids to prevent them from
    # revoking their own access
    safe_user_ids = [user_id for user_id in user_ids if user_id != owner_id]

    if not safe_user_ids:
        return

    subquery = Asset.objects.values_list('pk', flat=True).filter(
        owner_id=owner_id
    )
    perms_to_delete = ObjectPermission.objects.filter(
        asset_id__in=subquery, user_id__in=safe_user_ids
    )

    batch_size = settings.DEFAULT_BATCH_SIZE
    while perms_to_delete.exists():
        pks_to_delete = list(perms_to_delete.values_list('pk', flat=True)[:batch_size])
        ObjectPermission.objects.filter(pk__in=pks_to_delete).delete()
