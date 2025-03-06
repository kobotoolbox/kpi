from datetime import timedelta
from math import inf

from django.db.models import Q, QuerySet
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.stripe.utils import get_organization_plan_limits
from kpi.utils.usage_calculator import get_storage_usage_by_user_id


def get_inactive_users(days: int = 365) -> QuerySet:
    """
    Retrieve users who have been inactive for a specified number of days.

    A user is considered inactive if:
    - They have not logged in within the given period (or never logged in).
    - They have not modified or created an XForm within the given period.
    - They have not modified or have a submission within the given period.

    :param days: int: Number of days to determine inactivity (default: 365 days)

    :return: A queryset of inactive users
    """
    # Calculate the user inactivity threshold date
    days = days or 365
    inactivity_threshold = now() - timedelta(days=days)

    # Identify users who have not logged in within the given period
    inactive_users = User.objects.filter(
        Q(last_login__lt=inactivity_threshold) | Q(last_login__isnull=True)
    )

    # Find users who have active forms or submissions within the given period
    active_users = XForm.objects.filter(
        Q(date_modified__gt=inactivity_threshold) |
        Q(date_created__gt=inactivity_threshold) |
        Q(instances__date_modified__gt=inactivity_threshold) |
        Q(instances__date_created__gt=inactivity_threshold)
    ).values_list('user', flat=True)

    # Exclude active users from the inactive list
    return inactive_users.exclude(id__in=set(active_users))


def get_users_within_range_of_usage_limit(
    minimum: float = 0, maximum: float = inf
) -> QuerySet:
    """
    Returns all users whose storage usage is between minimum and maximum percent
    of their plan limit

    :param minimum: float. Minimum usage, eg 0.9 for 90% of the limit. Default 0
    :param maximum: float. Maximum usage, eg 1 for 100% of the limit. Default inf
    """
    minimum = minimum or 0
    maximum = maximum or inf
    storage_limits_by_org = get_organization_plan_limits(usage_type='storage')
    storage_usage_by_user = get_storage_usage_by_user_id()
    owner_by_org = {
        org.id: org.owner_user_object.pk
        for org in Organization.objects.filter(owner__isnull=False)
    }
    storage_limits_by_owner = {
        owner_by_org[org_id]: limit for org_id, limit in storage_limits_by_org.items()
    }
    user_ids = []
    for user_id, usage in storage_usage_by_user.items():
        limit = storage_limits_by_owner.get(user_id, inf)
        if minimum * limit <= usage < maximum * limit:
            user_ids.append(user_id)
    return User.objects.filter(id__in=user_ids)


def get_users_over_90_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(minimum=0.9, maximum=1)
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(minimum=1)
    return [user.extra_details.uid for user in results]
