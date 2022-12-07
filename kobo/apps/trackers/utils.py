from datetime import datetime
from typing import Optional

from django.db.models.expressions import RawSQL

from kobo.apps.trackers.models import MonthlyNLPUsageCounter


def update_nlp_counter(
        service: str,
        amount: int,
        user_id: int,
        asset_id: Optional[int] = None
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
    date = datetime.today()
    criteria = dict(
        year=date.year,
        month=date.month,
        user_id=user_id,
        asset_id=asset_id,
    )
    # Ensure the counter for the month exists first
    MonthlyNLPUsageCounter.objects.get_or_create(**criteria)

    # Updating this way because other methods were messy and less reliable
    # than using the rawSQL method
    sql = f"""
        jsonb_set(
            counters,
            '{{{service}}}',
            (COALESCE(counters->>'{service}','0')::int + {amount})::text::jsonb
        )
    """
    MonthlyNLPUsageCounter.objects.filter(**criteria).update(
        counters=RawSQL(sql, [])
    )
