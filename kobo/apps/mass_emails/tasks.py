from datetime import timedelta

from constance import config
from django.utils.timezone import now

from kobo.celery import celery_app
from kobo.apps.mass_emails.models import (
    EmailStatus,
    MassEmailRecord,
    MassEmailJob,
    USER_QUERIES
)
from kpi.utils.log import logging


@celery_app.task
def mark_old_enqueued_mass_email_record_as_failed():
    """
    Update MassEmailRecord entries with status 'enqueued' to 'failed' if older
    than a specified number of days
    """
    threshold_date = now() - timedelta(
        days=config.MASS_EMAIL_ENQUEUED_RECORD_EXPIRY
    )
    updated_records = MassEmailRecord.objects.filter(
        status=EmailStatus.ENQUEUED,
        date_created__lt=threshold_date
    ).update(status=EmailStatus.FAILED)

    logging.info(
        f'Updated {updated_records} MassEmailRecord(s) from `enqueued` to `failed` '
        f'that were older than {threshold_date}.'
    )


def enqueue_mass_email_records(email_config):
    """
    Creates a email job and enqueues email records for users based on query
    """
    job = MassEmailJob.objects.create(email_config=email_config)
    users = USER_QUERIES.get(email_config.query, lambda: [])()

    records = [
        MassEmailRecord(user=user, email_job=job, status=EmailStatus.ENQUEUED)
        for user in users
    ]
    MassEmailRecord.objects.bulk_create(records)

    logging.info(
        f'Created {len(records)} MassEmailRecord(s) for {email_config.name} '
        f'with query {email_config.query}'
    )
