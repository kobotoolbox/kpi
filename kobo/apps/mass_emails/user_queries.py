from datetime import timedelta
from math import inf

from django.conf import settings
from django.db.models import Q, QuerySet
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.utils import get_organizations_effective_limits
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


def get_users_within_range_of_usage_limit(
    usage_types: list[UsageType], minimum: float = 0, maximum: float = inf
) -> QuerySet:
    """
    Returns all users whose usage is between minimum and maximum percent
    of their plan limit for any of the given usage types.

    :param usage_types: list[UsageType].
    :param minimum: float. Minimum usage, eg 0.9 for 90% of the limit. Default 0
    :param maximum: float. Maximum usage, eg 1 for 100% of the limit. Default inf
    """
    if not settings.STRIPE_ENABLED:
        return User.objects.none()

    cached_nlp_usage = {}

    # cheat so that we don't fetch information twice if we're looking for nlp usage
    def get_nlp_usage_method(nlp_usage_type):
        def get_nlp_usage():
            if cached_nlp_usage == {}:
                cached_nlp_usage.update(
                    get_nlp_usage_for_current_billing_period_by_user_id()
                )
            return {
                userid: usages[nlp_usage_type]
                for userid, usages in cached_nlp_usage.items()
            }

        return get_nlp_usage

    usage_method_by_type = {
        'submission': get_submissions_for_current_billing_period_by_user_id,
        'storage': get_storage_usage_by_user_id,
        'seconds': get_nlp_usage_method('seconds'),
        'characters': get_nlp_usage_method('characters'),
    }

    minimum = minimum or 0
    maximum = maximum or inf
    include_storage_addons = 'storage' in usage_types
    include_onetime_addons = (
        'submission' in usage_types
        or 'seconds' in usage_types
        or 'characters' in usage_types
    )
    org_ids_with_no_owner = list(
        Organization.objects.filter(owner__isnull=True).values_list('pk', flat=True)
    )
    limits_by_org = get_organizations_effective_limits(
        include_storage_addons=include_storage_addons,
        include_onetime_addons=include_onetime_addons,
    )

    # filter out any organization with no owner
    limits_by_org = {
        org_id: limits
        for org_id, limits in limits_by_org.items()
        if org_id not in org_ids_with_no_owner
    }

    owner_by_org = {
        org.id: org.owner_user_object.pk
        for org in Organization.objects.filter(owner__isnull=False)
    }
    limits_by_owner = {
        owner_by_org[org_id]: limits for org_id, limits in limits_by_org.items()
    }
    user_ids = set()

    for usage_type in usage_types:
        usage_by_user = usage_method_by_type[usage_type]()
        for user_id, usage in usage_by_user.items():
            limit = limits_by_owner.get(user_id, {}).get(f'{usage_type}_limit', inf)
            if minimum * limit <= usage < maximum * limit:
                user_ids.add(user_id)

    return User.objects.filter(id__in=user_ids)


def get_users_over_90_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(
        usage_types=['storage'], minimum=0.9, maximum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_storage_limit():
    results = get_users_within_range_of_usage_limit(usage_types=['storage'], minimum=1)
    return [user.extra_details.uid for user in results]


def get_users_over_90_percent_of_submission_limit():
    results = get_users_within_range_of_usage_limit(
        usage_types=['submission'], minimum=0.9, maximum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_submission_limit():
    results = get_users_within_range_of_usage_limit(
        usage_types=['submission'], minimum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_90_percent_of_nlp_limits():
    results = get_users_within_range_of_usage_limit(
        usage_types=['characters', 'seconds'], minimum=0.9, maximum=1
    )
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_nlp_limits():
    results = get_users_within_range_of_usage_limit(
        usage_types=['characters', 'seconds'], minimum=1
    )
    return [user.extra_details.uid for user in results]
