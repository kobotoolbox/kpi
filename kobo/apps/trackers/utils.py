from typing import Optional, Union

from django.apps import apps
from django.conf import settings
from django.db.models import F
from django.utils import timezone
from django_request_cache import cache_for_request

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.types import UsageType
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.utils import get_organization_plan_limit
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
    deduct = settings.STRIPE_ENABLED
    kwargs = {}
    if service.endswith('asr_seconds'):
        kwargs['total_asr_seconds'] = F('total_asr_seconds') + amount
        if deduct and asset_id is not None:
            handle_usage_deduction(organization, 'seconds', amount)
    if service.endswith('mt_characters'):
        kwargs['total_mt_characters'] = F('total_mt_characters') + amount
        if deduct and asset_id is not None:
            handle_usage_deduction(organization, 'characters', amount)

    NLPUsageCounter.objects.filter(pk=counter_id).update(
        counters=IncrementValue('counters', keyname=service, increment=amount),
        **kwargs,
    )


@cache_for_request
def get_organization_usage(organization: Organization, usage_type: UsageType) -> int:
    """
    Get the used amount for a given organization and usage type
    """
    usage_calc = ServiceUsageCalculator(
        organization.owner.organization_user.user, disable_cache=True
    )
    usage = usage_calc.get_nlp_usage_by_type(USAGE_LIMIT_MAP[usage_type])

    return usage


def get_organization_remaining_usage(
    organization: Organization, usage_type: UsageType
) -> Union[int, None]:
    """
    Get the organization remaining usage count for a given limit type
    """
    addon_remaining = 0
    if settings.STRIPE_ENABLED:
        PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa
        _, addon_remaining = PlanAddOn.get_organization_totals(
            organization,
            usage_type,
        )

    plan_limit = get_organization_plan_limit(organization, usage_type)
    if plan_limit is None:
        plan_limit = 0
    usage = get_organization_usage(organization, usage_type)
    plan_remaining = max(0, plan_limit - usage)  # if negative, they have 0 remaining
    total_remaining = addon_remaining + plan_remaining

    return total_remaining


def handle_usage_deduction(
    organization: Organization, usage_type: UsageType, amount: int
):
    """
    Deducts the specified usage type for this organization by the given amount
    """
    PlanAddOn = apps.get_model('stripe', 'PlanAddOn')

    plan_limit = get_organization_plan_limit(organization, usage_type)
    current_usage = get_organization_usage(organization, usage_type)
    if current_usage is None:
        current_usage = 0
    new_total_usage = current_usage + amount
    if new_total_usage > plan_limit:
        deduction = (
            amount if current_usage >= plan_limit else new_total_usage - plan_limit
        )
        PlanAddOn.deduct_add_ons_for_organization(organization, usage_type, deduction)
