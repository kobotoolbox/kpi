import json
from datetime import datetime, time, timedelta
from math import ceil

from constance import config
from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q
from django.utils.timezone import get_current_timezone, localdate, now
from django.utils.translation import gettext

from kobo.apps.mass_emails.models import (
    USER_QUERIES,
    EmailStatus,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)
from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer

templates_placeholders = {
    '##username##': 'username',
    '##full_name##': 'full_name',
    '##plan_name##': 'plan_name',
    '##date_created##': 'date_created',
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
    rendered = template
    for placeholder, value in templates_placeholders.items():
        rendered = rendered.replace(placeholder, data[value])
    return rendered


class MassEmailSender:

    def __init__(self):
        self.today = localdate()
        self.cache_key = f'mass_emails_{self.today.isoformat()}_email_limits'
        self.total_records = MassEmailRecord.objects.filter(
            status=EmailStatus.ENQUEUED
        ).count()
        self.configs = MassEmailConfig.objects.annotate(
            enqueued_records_count=Count(
                'jobs__records',
                filter=Q(jobs__records__status=EmailStatus.ENQUEUED),
            )
        )
        logging.info(f'Found {self.total_records} enqueued records')
        self.get_day_limits()

    def get_day_limits(self):
        MAX_EMAILS = settings.MAX_MASS_EMAILS_PER_DAY
        serialized_data = cache.get(self.cache_key)
        if not serialized_data:
            logging.info('Setting up MassEmailConfig limits for the current day')
            self.limits = {}
            if self.total_records < MAX_EMAILS:
                for email_config in self.configs:
                    self.limits[email_config.id] = email_config.enqueued_records_count
            else:
                total_limits = 0
                for email_config in self.configs:
                    if total_limits >= MAX_EMAILS:
                        break
                    config_limit = ceil(
                        email_config.enqueued_records_count
                        / self.total_records
                        * MAX_EMAILS
                    )
                    if total_limits + config_limit > MAX_EMAILS:
                        config_limit = MAX_EMAILS - total_limits
                    self.limits[email_config.id] = config_limit
                    total_limits += config_limit
        else:
            self.limits = json.loads(serialized_data)

    def send_day_emails(self):
        for email_config in self.configs:
            limit = self.limits.get(email_config.id)
            if not limit:
                continue
            records = MassEmailRecord.objects.filter(
                status=EmailStatus.ENQUEUED,
                email_job__email_config=email_config,
            )[:limit]
            logging.info(
                f'Processing {limit} records for MassEmailConfig({email_config})'
            )
            for record in records:
                self.send_email(email_config, record)
            self.limits[email_config.id] = 0
            self.update_day_limits()

    def send_email(self, email_config, record):
        logging.info(f'Processing MassEmailRecord({record})')
        org_user = record.user.organization.organization_users.get(user=record.user)
        plan_name = org_user.active_subscription_status
        if plan_name == '' or plan_name is None:
            plan_name = gettext('Community Plan')
        data = {
            'username': record.user.username,
            'full_name': record.user.first_name + ' ' + record.user.last_name,
            'plan_name': plan_name,
            'date_created': record.date_created.strftime('%Y-%m-%d %H:%M'),
        }
        content = render_template(email_config.template, data)
        message = EmailMessage(
            to=record.user.email,
            subject=email_config.subject,
            plain_text_content_or_template=content,
            html_content_or_template=content,
        )
        try:
            sent = Mailer.send(message)
        except Exception as e:
            logging.exception(f'Error when attempting to send record {record}')
            sent = False
        if sent:
            record.status = EmailStatus.SENT
        else:
            record.status = EmailStatus.FAILED

        record.save()

    def update_day_limits(self):
        today_dt = datetime.combine(
            self.today, time(0, 0, 0, 0, get_current_timezone())
        )
        timedelta_to_midnight = (today_dt + timedelta(days=1)) - now()
        TTL = timedelta_to_midnight.total_seconds()
        serialized_data = json.dumps(self.limits)
        cache.set(self.cache_key, serialized_data, TTL)


@celery_app.task(time_limit=3600)  # 1 hour limit
def send_emails():
    sender = MassEmailSender()
    sender.send_day_emails()
