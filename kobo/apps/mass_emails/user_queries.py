from math import inf

from django.db.models import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.utils import get_organization_plan_limits
from kpi.utils.usage_calculator import (
    get_storage_usage_by_user_id,
    get_submissions_for_current_billing_period_by_user_id,
)


def get_users_within_range_of_usage_limit(
    usage_type: UsageType, minimum: float = 0, maximum: float = inf
) -> QuerySet:
    """
    Returns all users whose usage is between minimum and maximum percent
    of their plan limit for the given usage type

    :param usage_type: UsageType. 'submission' or 'storage'
    :param minimum: float. Minimum usage, eg 0.9 for 90% of the limit. Default 0
    :param maximum: float. Maximum usage, eg 1 for 100% of the limit. Default inf
    """
    usage_method_by_type = {
        'submission': get_submissions_for_current_billing_period_by_user_id,
        'storage': get_storage_usage_by_user_id,
    }
    minimum = minimum or 0
    maximum = maximum or inf
    limits_by_org = get_organization_plan_limits(usage_type=usage_type)
    usage_by_user = usage_method_by_type[usage_type]()
    owner_by_org = {
        org.id: org.owner_user_object.pk
        for org in Organization.objects.filter(owner__isnull=False)
    }
    limits_by_owner = {
        owner_by_org[org_id]: limit for org_id, limit in limits_by_org.items()
    }
    user_ids = []
    for user_id, usage in usage_by_user.items():
        limit = limits_by_owner.get(user_id, inf)
        if minimum * limit <= usage < maximum * limit:
            user_ids.append(user_id)
    return User.objects.filter(id__in=user_ids)


def get_users_over_90_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(
        usage_type='storage', minimum=0.9, maximum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(usage_type='storage', minimum=1)
    return [user.extra_details.uid for user in results]


def get_users_over_90_percent_of_submission_limit():
    results = get_users_within_range_of_usage_limit(
        usage_type='submission', minimum=0.9, maximum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_submission_limit():
    results = get_users_within_range_of_usage_limit(usage_type='submission', minimum=1)
    return [user.extra_details.uid for user in results]
