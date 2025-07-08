from math import inf
from typing import Optional, Union

from django.apps import apps
from django.conf import settings
from django.db.models import F
from django.utils import timezone
from django_request_cache import cache_for_request

from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit
from kobo.apps.stripe.utils.subscription_limits import (
    get_organization_subscription_limit,
)
from kpi.utils.django_orm_helper import IncrementValue
from kpi.utils.usage_calculator import ServiceUsageCalculator


def update_nlp_counter(
    service: str,
    amount: int,
    user_id: int,
    asset_id: Optional[int] = None,
    counter_id: Optional[int] = None,
):
    """
    Update the NLP ASR and MT tracker for various services
        Params:
            service (str): Service tracker to be updated, provider_service_type
                for example:
                    google_asr_seconds
            amount (int): units used. It could be seconds or characters depending
                on the service
            user_id (int): id of the asset owner
            asset_id (int) or None: Primary key for Asset Model
            counter_id (int) or None: Primary key for NLPUsageCounter instance
    """
    # Avoid circular import
    NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')  # noqa
    organization = Organization.get_from_user_id(user_id)

    if not counter_id:
        date = timezone.now()
        criteria = dict(
            date=date.date(),
            user_id=user_id,
            asset_id=asset_id,
        )

        # Ensure the counter for the date exists first
        counter, _ = NLPUsageCounter.objects.get_or_create(**criteria)
        counter_id = counter.pk

    # Update the total counters by the usage amount to keep them current
    stripe_enabled = settings.STRIPE_ENABLED
    kwargs = {}
    if service.endswith(UsageType.ASR_SECONDS):
        kwargs['total_asr_seconds'] = F('total_asr_seconds') + amount
        if stripe_enabled and asset_id is not None:
            handle_usage_deduction(organization, UsageType.ASR_SECONDS, amount)
    if service.endswith(UsageType.MT_CHARACTERS):
        kwargs['total_mt_characters'] = F('total_mt_characters') + amount
        if stripe_enabled and asset_id is not None:
            handle_usage_deduction(organization, UsageType.MT_CHARACTERS, amount)

    NLPUsageCounter.objects.filter(pk=counter_id).update(
        counters=IncrementValue('counters', keyname=service, increment=amount),
        **kwargs,
    )

    if not stripe_enabled:
        return

    if service.endswith(UsageType.ASR_SECONDS):
        check_exceeded_limit(organization.owner_user_object, UsageType.ASR_SECONDS)
    if service.endswith(UsageType.MT_CHARACTERS):
        check_exceeded_limit(organization.owner_user_object, UsageType.MT_CHARACTERS)


@cache_for_request
def get_organization_usage(organization: Organization, usage_type: UsageType) -> int:
    """
    Get the used amount for a given organization and usage type
    """
    usage_calc = ServiceUsageCalculator(
        organization.owner.organization_user.user, disable_cache=True
    )
    usage = usage_calc.get_nlp_usage_by_type(usage_type)

    return usage


def get_organization_remaining_usage(
    organization: Organization, usage_type: UsageType
) -> Union[int, None]:
    """
    Get the organization remaining usage count for a given limit type
    """
    if not settings.STRIPE_ENABLED:
        return inf
    addon_remaining = 0
    if settings.STRIPE_ENABLED:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        _, addon_remaining = PlanAddOn.get_organization_totals(
            organization,
            usage_type,
        )

    plan_limit = get_organization_subscription_limit(organization, usage_type)
    if plan_limit is None:
        plan_limit = 0
    usage = get_organization_usage(organization, usage_type)
    plan_remaining = max(0, plan_limit - usage)  # if negative, they have 0 remaining
    total_remaining = addon_remaining + plan_remaining

    return total_remaining


@requires_stripe
def handle_usage_deduction(
    organization: Organization, usage_type: UsageType, amount: int, **kwargs
):
    """
    Deducts the specified usage type for this organization by the given amount
    """
    PlanAddOn = kwargs['plan_add_on_model']

    plan_limit = get_organization_subscription_limit(organization, usage_type)
    current_usage = get_organization_usage(organization, usage_type)
    if current_usage is None:
        current_usage = 0
    new_total_usage = current_usage + amount
    if new_total_usage > plan_limit:
        deduction = (
            amount if current_usage >= plan_limit else new_total_usage - plan_limit
        )
        PlanAddOn.deduct_add_ons_for_organization(organization, usage_type, deduction)
