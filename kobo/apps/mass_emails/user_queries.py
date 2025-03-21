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
    get_organization_nlp_plan_limits,
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


def get_users_within_range_of_nlp_usage_limit(minimum: float = 0, maximum: float = inf):
    """
    Returns all users whose NLP usage is between minimum and maximum percent of their
    limits. This includes both limits on seconds and on characters. If users are within
    the range for either measurement, they will be included.

    :param minimum: float. Minimum usage, eg 0.9 for 90% of the limit. Default 0
    :param maximum: float. Maximum usage, eg 1 for 100% of the limit. Default inf
    """
    minimum = minimum or 0
    maximum = maximum or inf
    limits_by_org = get_organization_nlp_plan_limits()
    if settings.STRIPE_ENABLED:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        add_ons = PlanAddOn.get_all_organization_totals()
        for org_id, values in add_ons.items():
            limits_by_org[org_id]['characters']['total_usage_limit'] += values['characters'][
                'total_usage_limit'
            ]
            limits_by_org[org_id]['seconds']['total_usage_limit'] += values['seconds']['total_usage_limit']
    usage_by_user = get_nlp_usage_for_current_billing_period_by_user_id()
    owner_by_org = {
        org.id: org.owner_user_object.pk
        for org in Organization.objects.filter(owner__isnull=False)
    }
    limits_by_owner = {
        owner_by_org[org_id]: limit for org_id, limit in limits_by_org.items()
    }
    user_ids = []
    for user_id, usage in usage_by_user.items():

        seconds_limit = limits_by_owner[user_id]['seconds']['total_usage_limit']
        characters_limit = limits_by_owner[user_id]['characters']['total_usage_limit']
        seconds_usage = usage['total_asr_seconds']
        characters_usage = usage['total_mt_characters']
        seconds_usage_in_range = (
            minimum * seconds_limit <= seconds_usage < maximum * seconds_limit
        )
        characters_usage_in_range = (
            minimum * characters_limit <= characters_usage < maximum * characters_limit
        )
        if seconds_usage_in_range or characters_usage_in_range:
            user_ids.append(user_id)
    return User.objects.filter(id__in=user_ids)


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


def get_users_over_90_percent_of_nlp_limits():
    results = get_users_within_range_of_nlp_usage_limit(0.9, 1)
    return [user.extra_details.uid for user in results]


def get_users_over_100_percent_of_nlp_limits():
    results = get_users_within_range_of_nlp_usage_limit(1)
    return [user.extra_details.uid for user in results]
