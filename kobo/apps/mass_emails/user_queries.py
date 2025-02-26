from math import inf

from django.apps import apps
from django.conf import settings
from django.db.models import F, IntegerField, Max, Q, Sum, Window
from django.db.models.functions import Cast, Coalesce
from djstripe.models.core import Product

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES


def get_active_subscription_storage_limit_by_owner(
    owner_ids: list[int] = None,
) -> dict[str, dict]:
    """
    Get the storage limit for all active paid subscriptions by org owner.
    If an org has multiple, use the one with the earliest start date.
    Example value:
    1: {'limit': '100000000', 'product_type':'plan'}
    """
    orgs = Organization.objects.prefetch_related('djstripe_customers')
    if owner_ids is not None:
        orgs = orgs.filter(owner__organization_user__user__in=owner_ids)
    all_owner_plans = (
        orgs.filter(
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES
        )
        .values(
            owner_user_id=F('owner__organization_user__user'),
            # prefer price metadata over product metadata
            limit=Coalesce(
                F(
                    'djstripe_customers__subscriptions__items__price__metadata__storage_bytes_limit'
                ),
                F(
                    'djstripe_customers__subscriptions__items__price__product__metadata__storage_bytes_limit'
                ),
            ),
            start_date=F('djstripe_customers__subscriptions__start_date'),
            product_type=F(
                'djstripe_customers__subscriptions__items__price__product__metadata__product_type'
            ),
        )
        .annotate(
            # find the one with the earliest start date
            earliest=Window(
                expression=Max('start_date'),
                partition_by=F('owner_user_id'),
                order_by='owner_user_id',
            )
        )
        .filter(Q(start_date=F('earliest')))
    )

    return {
        res['owner_user_id']: {
            'limit': res['limit'],
            'product_type': res['product_type'],
        }
        for res in all_owner_plans
    }


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
    all_owner_plans = get_active_subscription_storage_limit_by_owner()
    all_storage_add_ons = get_storage_limit_addons_by_user()
    # find the storage limit for the default (ie free) plan
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
