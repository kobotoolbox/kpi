from math import inf

from django.db.models import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils import get_organization_plan_limits
from kpi.utils.usage_calculator import get_storage_usage_by_user_id


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
