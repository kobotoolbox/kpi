from math import inf

from django.apps import apps
from django.conf import settings
from django.db.models import F, Max, Q, QuerySet, Window
from django.db.models.functions import Coalesce

from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageLimits
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.stripe.utils.import_management import requires_stripe


def _get_default_usage_limits():
    return {f'{usage_type}_limit': inf for usage_type, _ in UsageType.choices}


def _get_limit_key(usage_type: UsageType):
    return f'{usage_type}_limit'


def _get_subscription_metadata_fields_for_usage_type(usage_type: UsageType):
    limit_key = _get_limit_key(usage_type)
    return (
        f'items__price__metadata__{limit_key}',
        f'items__price__product__metadata__{limit_key}',
    )


def get_default_add_on_limits():
    return {
        f'{UsageType.SUBMISSION}_limit': 0,
        f'{UsageType.ASR_SECONDS}_limit': 0,
        f'{UsageType.MT_CHARACTERS}_limit': 0,
    }


@requires_stripe
def get_organization_subscription_limit(
    organization: Organization, usage_type: UsageType, **kwargs
) -> int | float:
    """
    Get organization plan limit for a given usage type,
    will fall back to infinite value if no subscription or
    default free tier plan found.
    """
    include_storage_addons = usage_type == UsageType.STORAGE_BYTES
    return (
        get_organizations_subscription_limits([organization], include_storage_addons)
        .get(organization.id, {})
        .get(f'{usage_type}_limit')
    )


@requires_stripe
def get_organizations_subscription_limits(
    organizations: list[Organization] = None,
    include_storage_addons: bool = True,
    **kwargs,
) -> dict[str, UsageLimits]:
    """
    Return the all usage limits for given organizations based on their recurring
    subscriptions.

    To determine an organization's limits:
    1. Get the most recent active plans and storage addons
    2. If there is an active plan, set the limits to the limits of the plan
    3. If there is no active plan, set the limits to the limits of the default plan
    4. If there is a storage addon, update the storage limit to
     max(storage addon, existing limit)

    Example result:
    { 'org1':
        {
            'storage_bytes_limit': inf,
            'submission_limit': 5000,
            'mt_characters_limit': 72000,
            'asr_seconds_limit': 6000,
        },
        ...
    }

    :param organizations: List of organizations to use. Gets all orgs if not provided.
    :param include_storage_addons: bool. Include storage addons in the calculation
    """
    Product = kwargs['product_model']

    # determine which orgs we care about and get their ids
    if organizations is not None:
        orgs = organizations
    else:
        orgs = Organization.objects.all()
    all_org_ids = [org.id for org in orgs]

    # get paid subscription limits
    subscription_limits = get_paid_subscription_limits(all_org_ids)
    subscription_limits_by_org_id = {}
    for row in subscription_limits:
        row_limits = subscription_limits_by_org_id.get(row['org_id'], {})
        if row['product_type'] == 'plan':
            row_limits = {
                f'{usage_type}_limit': row[f'{usage_type}_limit']
                for usage_type, _ in UsageType.choices
            }
        elif row['product_type'] == 'addon':
            row_limits['addon_storage_limit'] = row[f'{UsageType.STORAGE_BYTES}_limit']
        subscription_limits_by_org_id[row['org_id']] = row_limits

    storage_limit = _get_limit_key(UsageType.STORAGE_BYTES)
    submission_limit = _get_limit_key(UsageType.SUBMISSION)
    characters_limit = _get_limit_key(UsageType.MT_CHARACTERS)
    seconds_limit = _get_limit_key(UsageType.ASR_SECONDS)
    # Anyone who does not have a subscription is on the free tier plan by default
    default_plan = (
        Product.objects.filter(metadata__default_free_plan='true')
        .values(
            storage_bytes_limit=F(f'metadata__{storage_limit}'),
            submission_limit=F(f'metadata__{submission_limit}'),
            mt_characters_limit=F(f'metadata__{characters_limit}'),
            asr_seconds_limit=F(f'metadata__{seconds_limit}'),
        )
        .first()
    ) or {}
    default_plan_limits = {}
    for usage_type, _ in UsageType.choices:
        limit_key = f'{usage_type}_limit'
        default_limit = default_plan.get(limit_key)
        if default_limit is None:
            default_plan_limits[limit_key] = 'unlimited'
        else:
            default_plan_limits[limit_key] = default_limit

    results = {}
    for org_id in all_org_ids:
        all_org_limits = {}
        for usage_type, _ in UsageType.choices:
            plan_limit = subscription_limits_by_org_id.get(org_id, {}).get(
                f'{usage_type}_limit'
            )
            addon_limit = subscription_limits_by_org_id.get(org_id, {}).get(
                'addon_storage_limit'
            )
            default_limit = default_plan_limits[f'{usage_type}_limit']
            limit = determine_limit(
                usage_type,
                plan_limit,
                addon_limit,
                default_limit,
                include_storage_addons,
            )
            all_org_limits[f'{usage_type}_limit'] = limit
        results[org_id] = all_org_limits

    return results


def get_organizations_effective_limits(
    organizations: list[Organization] = None,
    include_storage_addons=True,
    include_onetime_addons=True,
) -> dict[str, UsageLimits]:
    """
    Return the all usage limits for given organizations based on their recurring
    subscriptions and one-time addons. If Stripe is not enabled, returns inf for
    all limits.

    Example result:
    { 'org1':
        {
            'storage_limit': inf,
            'submission_limit': 5000,
            'characters_limit': 72000,
            'seconds_limit': 6000,
        },
        ...
    }

    :param organizations: List of organizations to use. Gets all orgs if not provided.
    :param include_storage_addons: bool. Include storage addons in the calculation
    :param include_onetime_addons: bool. Include onetime addons in the calculation
    """

    if not settings.STRIPE_ENABLED:
        orgs = organizations or Organization.objects.all()
        return {org.id: _get_default_usage_limits() for org in orgs}

    effective_limits = get_organizations_subscription_limits(
        include_storage_addons=include_storage_addons, organizations=organizations
    )
    if include_onetime_addons:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        addon_limits = PlanAddOn.get_organizations_totals(organizations=organizations)
        for org_id, limits in effective_limits.items():
            for usage_type, _ in UsageType.choices:
                addon = addon_limits.get(org_id, {}).get(f'total_{usage_type}_limit', 0)
                limits[f'{usage_type}_limit'] += addon
    return effective_limits


@requires_stripe
def get_paid_subscription_limits(organization_ids: list[str], **kwargs) -> QuerySet:
    """
    Return the most recent limits for all usage types for given organizations based on
    their most recent subscriptions. If they have both a regular plan and an addon,
    returns a row for both. If no organization list is provided, information will be
    fetched for all subscriptions.

    Only works when Stripe is enabled.
    """
    Subscription = kwargs['subscription_model']

    price_storage_key, product_storage_key = (
        _get_subscription_metadata_fields_for_usage_type(UsageType.STORAGE_BYTES)
    )
    price_submission_key, product_submission_key = (
        _get_subscription_metadata_fields_for_usage_type(UsageType.SUBMISSION)
    )
    price_characters_key, product_characters_key = (
        _get_subscription_metadata_fields_for_usage_type(UsageType.MT_CHARACTERS)
    )
    price_seconds_key, product_seconds_key = (
        _get_subscription_metadata_fields_for_usage_type(UsageType.ASR_SECONDS)
    )

    # Get organizations we care about (either those in the 'organizations' param or all)
    org_filter = Q(customer__subscriber_id__in=[org_id for org_id in organization_ids])

    active_subscriptions = Subscription.objects.filter(
        org_filter
        & Q(status__in=ACTIVE_STRIPE_STATUSES)
        & Q(items__price__product__metadata__product_type__in=['plan', 'addon'])
    )

    most_recent_subs = (
        active_subscriptions.values(
            org_id=F('customer__subscriber_id'),
            storage_bytes_limit=Coalesce(F(price_storage_key), F(product_storage_key)),
            submission_limit=Coalesce(
                F(price_submission_key), F(product_submission_key)
            ),
            asr_seconds_limit=Coalesce(F(price_seconds_key), F(product_seconds_key)),
            mt_characters_limit=Coalesce(
                F(price_characters_key), F(product_characters_key)
            ),
            sub_start_date=F('start_date'),
            product_type=F('items__price__product__metadata__product_type'),
        )
        .annotate(
            # find the most recent one
            most_recent_plan=Window(
                expression=Max('sub_start_date', filter=Q(product_type='plan')),
                partition_by=F('org_id'),
                order_by='org_id',
            ),
            most_recent_addon=Window(
                expression=Max('sub_start_date', filter=Q(product_type='addon')),
                partition_by=F('org_id'),
                order_by='org_id',
            ),
        )
        .filter(
            # most recent full plan
            (Q(sub_start_date=F('most_recent_plan')) & Q(product_type='plan'))
            # most recent addon
            | (Q(sub_start_date=F('most_recent_addon')) & Q(product_type='addon'))
            # handle dates being null
            | (
                Q(sub_start_date__isnull=True)
                & Q(most_recent_addon__isnull=True)
                & Q(product_type='plan')
            )
            | (
                Q(sub_start_date__isnull=True)
                & Q(most_recent_addon__isnull=True)
                & Q(product_type='addon')
            )
        )
    )
    return most_recent_subs


def determine_limit(
    usage_type: UsageType,
    plan_limit,
    addon_limit,
    default_limit,
    include_storage_addons,
) -> float:
    # 1. do we have a regular subscription plan?
    limit = plan_limit or default_limit or inf
    # "unlimited" -> inf
    if limit == 'unlimited':
        limit = inf
    # convert string to int
    else:
        limit = float(limit)

    # for storage, factor in addons if specified
    if usage_type == UsageType.STORAGE_BYTES and include_storage_addons:
        if addon_limit == 'unlimited':
            addon_limit = inf
        else:
            addon_limit = int(addon_limit or 0)
        # take the max of the addon limit and the previously-calculated limit
        if addon_limit > limit:
            limit = addon_limit
    return limit
