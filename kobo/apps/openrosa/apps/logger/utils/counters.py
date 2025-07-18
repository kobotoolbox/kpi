from django.db.models import F

from kpi.deployment_backends.kc_access.utils import conditional_kc_transaction_atomic
from ...main.models import UserProfile
from ..models import XForm


def delete_null_user_daily_counters(apps, *args):
    """
    Find any DailyXFormCounters without a user, assign them to a user if we can,
    otherwise delete them.
    This function is reused between two migrations, logger.0030 and logger.0031.
    If/when those migrations get squashed, please delete this function
    """
    DailyXFormSubmissionCounter = apps.get_model(
        'logger', 'DailyXFormSubmissionCounter'
    )  # noqa

    counters_without_users = DailyXFormSubmissionCounter.objects.filter(user=None)

    if not counters_without_users.exists():
        return

    # Associate each daily counter with user=None with a user based on its xform
    batch = []
    batch_size = 5000
    for counter in (
        counters_without_users.exclude(xform=None)
        .exclude(xform__user=None)
        .iterator(chunk_size=batch_size)
    ):
        counter.user = counter.xform.user
        # don't add a user to duplicate counters, so they get deleted when we're
        # done looping
        if (
            DailyXFormSubmissionCounter.objects.filter(
                date=counter.date, xform=counter.xform
            )
            .exclude(user=None)
            .exists()
        ):
            continue
        batch.append(counter)
        if len(batch) >= batch_size:
            DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])
            batch = []
    if batch:
        DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])

    # Delete daily counters without a user to avoid creating invalid monthly counters
    DailyXFormSubmissionCounter.objects.filter(user=None).delete()


def update_storage_counters(xform_id: int, user_id: int, total_bytes: int):

    with conditional_kc_transaction_atomic():
        UserProfile.objects.filter(user_id=user_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + total_bytes
        )
        XForm.objects.filter(pk=xform_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + total_bytes
        )
