from django.conf import settings
from django.db.models import Count, Q
from django.utils.translation import gettext

from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer
from .models import (
    USER_QUERIES,
    EmailStatus,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)

templates_placeholders = {
    '##username##': 'username',
    '##full_name##': 'full_name',
    '##plan_name##': 'plan_name',
}


def render_template(template, data):
    rendered = template
    for placeholder, value in templates_placeholders.items():
        rendered = rendered.replace(placeholder, data[value])
    return rendered


def create_email_records(email_config):
    job = MassEmailJob.objects.create(
        email_config=email_config,
    )
    users = USER_QUERIES[email_config.query]()
    for user in users:
        MassEmailRecord.objects.create(
            user=user,
            email_job=job,
            status=EmailStatus.ENQUEUED,
        )


@celery_app.task
def send_emails(email_config_uid: str):
    email_config = MassEmailConfig.objects.annotate(
        jobs_count=Count('jobs'),
        records=Count(
            'jobs__records', filter=Q(jobs__records__status=EmailStatus.ENQUEUED)
        ),
    ).get(uid=email_config_uid)
    if email_config is None:
        return
    
    if email_config.jobs_count > 1:
        raise NotImplementedError

    if email_config.jobs_count == 0: # Create job if no job exists
        create_email_records(email_config)

    from_email = settings.DEFAULT_FROM_EMAIL
    logging.info(
        f'Processing MassEmailConfig(uid={email_config.uid}, '
        f'name={email_config.name}, subject={email_config.subject})'
    )
    for job in email_config.jobs.all():
        records = job.records.filter(status=EmailStatus.ENQUEUED)[
            : settings.MAX_MASS_EMAILS_PER_DAY
        ]
        for record in records:
            logging.info(f'Processing MassEmailRecord({record})')
            org_user = record.user.organization.organization_users.get(user=record.user)
            plan_name = org_user.active_subscription_status
            if plan_name == '' or plan_name is None:
                plan_name = gettext('Community Plan')
            data = {
                'username': record.user.username,
                'full_name': record.user.first_name + ' ' + record.user.last_name,
                'plan_name': plan_name,
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
