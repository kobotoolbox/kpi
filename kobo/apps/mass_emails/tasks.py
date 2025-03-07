from math import ceil

from django.conf import settings
from django.db.models import Count, Q

from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer
from .models import EmailStatus, MassEmailConfig, MassEmailJob, MassEmailRecord

templates_placeholders = {
    '##username##': 'username',
    '##full_name##': 'full_name',
    '##plan_name##': 'plan_name',
}


def render_template(template, data):
    for placeholder, value in templates_placeholders.items():
        rendered = template.replace(placeholder, data[value])
    return rendered


def create_email_records(email_config):
    job = MassEmailJob.objects.create(
        email_config=email_config,
    )
    users = []
    for user in users:
        MassEmailRecord.objects.create(
            user=user,
            email_job=job,
            status=EmailStatus.ENQUEUED,
        )


@celery_app.task
def send_emails():
    # If a config has no jobs, attempt to create their jobs
    configs_job_counts = MassEmailConfig.objects.annotate(jobs_count=Count('jobs'))
    for pending_config in configs_job_counts.filter(jobs_count=0):
        create_email_records(pending_config)

    configs_records = MassEmailConfig.objects.annotate(
        records=Count(
            'jobs__records', filter=Q(jobs__records__status=EmailStatus.ENQUEUED)
        )
    ).all()
    configs_count = len(configs_records)
    if configs_count == 0:
        return

    emails_per_config = ceil(settings.MAX_MASS_EMAILS_PER_DAY / configs_count)
    from_email = settings.DEFAULT_FROM_EMAIL
    emails_remaining = settings.MAX_MASS_EMAILS_PER_DAY
    for email_config in configs_records:
        logging.info(
            f'Processing MassEmailConfig(uid={email_config.uid}, '
            f'name={email_config.name}, subject={email_config.subject})'
        )
        for job in email_config.jobs.all():
            records = job.records.filter(status=EmailStatus.ENQUEUED)[
                :emails_per_config
            ]
            for record in records:
                logging.info(
                    f'Processing MassEmailRecord(uid={record.uid}, user={record.user})'
                )
                emails_remaining -= 1
                if emails_remaining == 0:
                    break
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
