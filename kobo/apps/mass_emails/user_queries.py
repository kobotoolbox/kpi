from datetime import timedelta
from math import inf

from django.apps import apps
from django.conf import settings
from django.db.models import Q, QuerySet
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.utils import (
    get_organization_plan_limits,
)
from kpi.models import Asset
from kpi.utils.usage_calculator import (
    get_nlp_usage_for_current_billing_period_by_user_id,
    get_storage_usage_by_user_id,
    get_submissions_for_current_billing_period_by_user_id,
)


def get_inactive_users(days: int = 365) -> QuerySet:
    """
    Retrieve users who have been inactive for a specified number of days.

    A user is considered inactive if:
    - They have not logged in within the given period (or never logged in).
    - They have not modified or created an asset within the given period.
    - They have not modified or have a submission within the given period.

    Note: Users created within the given period who never logged in are not
    considered inactive.

    :param days: int: Number of days to determine inactivity (default: 365 days)

    :return: A queryset of inactive users
    """
    # Calculate the user inactivity threshold date
    days = days or 365
    inactivity_threshold = now() - timedelta(days=days)

    # Identify users who have not logged in within the given period
    inactive_users = User.objects.filter(
        Q(last_login__lt=inactivity_threshold)
        | (Q(last_login__isnull=True) & Q(date_joined__lt=inactivity_threshold))
    )

    # Find users who have active projects within the given period
    active_asset_owners = Asset.objects.filter(
        Q(date_modified__gt=inactivity_threshold)
        | Q(date_created__gt=inactivity_threshold)
    ).values_list('owner_id', flat=True)

    # Find users who have active submissions within the given period
    active_submission_owners = Instance.objects.filter(
        Q(date_modified__gt=inactivity_threshold)
        | Q(date_created__gt=inactivity_threshold)
    ).values_list('xform__user_id', flat=True)

    active_users = set(active_asset_owners) | set(active_submission_owners)
    return inactive_users.exclude(Q(id__in=active_users) | Q(username='AnonymousUser'))
