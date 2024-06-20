from typing import Optional

from django.apps import apps
from django.db.models import F
from django.utils import timezone

from kpi.utils.django_orm_helper import (
    IncrementValues,
)


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
    """
    # Avoid circular import
    NLPUsageCounter = apps.get_model('trackers', 'NLPUsageCounter')  # noqa
    PlanAddOn = apps.get_model('stripe', 'PlanAddOn')  # noqa

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
    kwargs = {}
    keys_to_update = [service]
    values_to_update = [amount]
    addon_used_key_prefix = 'addon_used_'

    if service.endswith('asr_seconds'):
        kwargs['total_asr_seconds'] = F('total_asr_seconds') + amount
        if asset_id is not None:
            # If we're not updating the catch-all counter, increment any NLP add-ons the user may have
            remaining = PlanAddOn.increment_add_ons_for_user(
                user_id, 'seconds', amount
            )
            keys_to_update.append(addon_used_key_prefix + 'asr_seconds')
            values_to_update.append(amount - remaining)

    if service.endswith('mt_characters'):
        kwargs['total_mt_characters'] = F('total_mt_characters') + amount
        if asset_id is not None:
            remaining = PlanAddOn.increment_add_ons_for_user(
                user_id, 'character', amount
            )
            keys_to_update.append(addon_used_key_prefix + 'mt_characters')
            values_to_update.append(amount - remaining)

    NLPUsageCounter.objects.filter(pk=counter_id).update(
        counters=IncrementValues(
            'counters', keynames=keys_to_update, increments=values_to_update
        ),
        **kwargs,
    )
