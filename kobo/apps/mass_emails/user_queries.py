from math import inf

from django.apps import apps
from django.conf import settings
from django.db.models import F, IntegerField, Max, Q, Sum, Window
from django.db.models.functions import Cast, Coalesce

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.utils import get_organization_plan_limits


def get_storage_limit_addons_by_user(owner_ids: list[int] = None):
    """
    Get additional storage limits from add-ons purchased by org owner
    Example value:
    1:10000000000
    """

    PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
    add_ons = PlanAddOn.objects
    if owner_ids is not None:
        add_ons = add_ons.filter(
            organization__owner__organization_user__user__in=owner_ids
        )
    add_ons = (
        add_ons.filter(
            usage_limits__has_key='storage_bytes_limit',
            charge__refunded=False,
        )
        .values(
            owner_user_id=F('organization__owner__organization_user__user'),
            limit=F('usage_limits__storage_bytes_limit'),
        )
        .annotate(
            total_storage_limit=Coalesce(
                Sum(Cast('limit', output_field=IntegerField())),
                0,
                output_field=IntegerField(),
            ),
        )
    )
    return {res['owner_user_id']: res['total_storage_limit'] for res in add_ons}


def get_total_storage_limits_by_org_owner():
    all_owner_plans = get_organization_plan_limits(usage_type='storage')
    all_storage_add_ons = get_storage_limit_addons_by_user()
    # find the storage limit for the default (ie free) plan
    from djstripe.models.core import Product

    default_plan_storage_limit = (
        Product.objects.filter(
            prices__unit_amount=0, prices__recurring__interval='month'
        )
        .values_list('metadata__storage_bytes_limit', flat=True)
        .first()
    )
    all_org_owners = Organization.objects.exclude(owner__isnull=True).values_list(
        'owner__organization_user__user', flat=True
    )
    all_limits = {}
    for org_owner_id in all_org_owners:
        plan_limit = all_owner_plans.get(org_owner_id, None)
        # logic copied from stripe.utils.get_organization_plan_limit
        if plan_limit is None or (
            plan_limit['product_type'] == 'addon' and plan_limit['limit'] is None
        ):
            # if no plan, use the community plan limit
            total = default_plan_storage_limit
        else:
            total = plan_limit['limit']

        if total == 'unlimited':
            total = inf
        else:
            total = int(total)

        # add any additional bytes from purchased add_ons
        add_on_limit = all_storage_add_ons.get(org_owner_id, None)
        if add_on_limit is not None:
            total += int(add_on_limit)
        all_limits[org_owner_id] = total
    return all_limits


def get_all_storage_usage_by_owner():
    # logic copied from usage_calculator
    xform_query = (
        XForm.objects.exclude(pending_delete=True)
        .values('user')
        .annotate(bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0))
    )
    return {res['user']: res['bytes_sum'] for res in xform_query}


def get_users_within_x_percent_storage_limits(
    minimum: int = 0, maximum: int = inf
) -> list[str]:
    if not settings.STRIPE_ENABLED:
        return User.objects.none()
    minimum_percent = minimum / 100
    maximum_percent = maximum / 100
    all_limits_by_owner = get_total_storage_limits_by_org_owner()
    all_storage_by_owner = get_all_storage_usage_by_owner()
    users = []
    for owner_id, usage in all_storage_by_owner.items():
        storage_limit = all_limits_by_owner.get(owner_id, inf)
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
