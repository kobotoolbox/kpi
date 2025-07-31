from datetime import timedelta

from django.utils import timezone

from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.stripe.utils.limit_enforcement import update_or_remove_limit_counter
from kobo.celery import celery_app


@celery_app.task
def update_exceeded_limit_counters():
    qs = ExceededLimitCounter.objects.filter(
        days__gt=0,
        date_modified__date__lte=timezone.now().date() - timedelta(days=1)
    )

    for counter in qs:
        # Pass in id because celery can't take the django object as an arg
        update_counter.delay(counter.id)


@celery_app.task
def update_counter(counter_id):
    counter = (
        ExceededLimitCounter.objects.filter(id=counter_id)
        .select_related('user')
        .first()
    )
    if counter:
        update_or_remove_limit_counter(counter)
