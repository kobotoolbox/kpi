from datetime import timedelta

from constance import config
from django.conf import settings
from django.db.models import Count, Q
from django.utils.timezone import now

from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer
from kobo.apps.mass_emails.models import (
    EmailStatus,
    MassEmailRecord,
    MassEmailJob,
    USER_QUERIES
)

placeholder_values = {
    '##username##': 'username',
    '##full_name##': 'full_name',
    '##plan_name##': 'plan_name',
}


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


def render_template(template, data):
    for placeholder, value in placeholder_values.items():
        rendered = template.replace(placeholder, data[value])
    return rendered


@celery_app.task
def send_emails():
    # If a config has no jobs, attempt to create their jobs
    configs_job_counts = MassEmailConfig.objects.annotate(jobs_count=Count('jobs'))
    for pending_config in configs_job_counts.filter(jobs_count=0):
        pending_config.create_job_and_records()

    configs_records = MassEmailConfig.objects.annotate(
        records=Count(
            'jobs__records', filter=Q(jobs__records__status=EmailStatus.ENQUEUED)
        )
    ).all()
    configs_count = len(configs_records)
    if configs_count == 0:
        return

    emails_per_config = settings.MAX_MASS_EMAILS_PER_DAY // configs_count
    from_email = settings.DEFAULT_FROM_EMAIL
    for email_config in configs_records:
        for job in email_config.jobs.all():
            for record in job.records.filter(status=EmailStatus.ENQUEUED):
                data = {
                    'username': record.user.username,
                    'full_name': record.user.first_name + ' ' + record.user.last_name,
                    'plan_name': 'Test plan',
                }
                content = render_template(email_config.template, data)
                message = EmailMessage(
                    to=record.user.email,
                    subject=email_config.subject,
                    plain_text_content_or_template=content,
                    html_content_or_template=content,
                )
                sent = Mailer.send(message)
                if sent:
                    record.status = EmailStatus.SENT
                else:
                    record.status = EmailStatus.FAILED

                record.save()
