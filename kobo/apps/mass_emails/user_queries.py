from math import inf

from django.apps import apps
from django.conf import settings
from django.db.models import F

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils import get_organization_plan_limits
from kpi.utils.usage_calculator import get_storage_usage_by_user


def get_total_storage_limits_by_org():
    plan_limits_by_org = get_organization_plan_limits('storage')
    add_on_limits_by_org = {}
    if settings.STRIPE_ENABLED:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        add_on_limits_by_org = PlanAddOn.get_organization_totals('storage')
    result = {}
    for org_id, storage_limit in plan_limits_by_org.items():
        total_addon_storage_limit, _ = add_on_limits_by_org.get(org_id, (0, 0))
        result[org_id] = storage_limit + total_addon_storage_limit
    return result


def get_users_within_x_percent_storage_limits(
    minimum: int = 0, maximum: int = inf
) -> list[str]:
    if not settings.STRIPE_ENABLED:
        return User.objects.none()
    minimum_percent = minimum / 100
    maximum_percent = maximum / 100
    all_limits_by_org = get_total_storage_limits_by_org()
    all_org_owners = {
        res['id']: res['owner']
        for res in Organization.objects.values(
            'id', owner=F('owner__organization_user__user')
        )
    }
    all_limits_by_org_owner = {
        all_org_owners.get(org_id, None): org_limit
        for org_id, org_limit in all_limits_by_org.items()
        if all_org_owners.get(org_id, None) is not None
    }

    all_storage_usage_by_owner = get_storage_usage_by_user()
    users = []
    for owner_id, usage in all_storage_usage_by_owner.items():
        storage_limit = all_limits_by_org_owner.get(owner_id, inf)
        if (
            storage_limit != inf
            and minimum_percent * storage_limit
            <= usage
            < maximum_percent * storage_limit
        ):
            users.append(owner_id)
    # XForm objects are in a different db than UserExtraDetails, so it's easiest
    # to deal in User pk's for everything, then lookup uids at the end
    return User.objects.filter(id__in=users).values_list(
        'extra_details__uid', flat=True
    )


def get_users_with_90_storage():
    return get_users_within_x_percent_storage_limits(90, 100)


def get_users_with_100_storage():
    return get_users_within_x_percent_storage_limits(minimum=100)
