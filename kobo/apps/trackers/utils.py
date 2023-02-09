from datetime import datetime
from typing import Optional

from django.apps import apps

from kpi.utils.jsonbfield_helper import IncrementValue


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
    MonthlyNLPUsageCounter = apps.get_model('trackers', 'MonthlyNLPUsageCounter')  # noqa

    if not counter_id:
        date = datetime.today()
        criteria = dict(
            year=date.year,
            month=date.month,
            user_id=user_id,
            asset_id=asset_id,
        )

        # Ensure the counter for the month exists first
        counter, _ = MonthlyNLPUsageCounter.objects.get_or_create(**criteria)
        counter_id = counter.pk

    MonthlyNLPUsageCounter.objects.filter(pk=counter_id).update(
        counters=IncrementValue('counters', keyname=service, increment=amount)
    )
