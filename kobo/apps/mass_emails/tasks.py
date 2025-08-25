from datetime import date, datetime, time, timedelta
from enum import Enum
from math import ceil
from time import sleep
from typing import Optional

from constance import config
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.translation import gettext

from kobo.apps.mass_emails.models import (
    USER_QUERIES,
    EmailStatus,
    EmailType,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)
from kobo.apps.organizations.models import OrganizationUser
from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer

if settings.STRIPE_ENABLED:
    from kobo.apps.stripe.utils.subscription_limits import get_plan_name

templates_placeholders = {
    '##username##': 'username',
    '##full_name##': 'full_name',
    '##plan_name##': 'plan_name',
    '##date_created##': 'date_created',
}

PROCESSED_EMAILS_CACHE_KEY = 'mass_emails_{key_date}_emails'
TASK_TIMEOUT = (
    5 * 60 if getattr(settings, 'MASS_EMAILS_CONDENSE_SEND', False) else 60 * 60
)  # 5 minutes if condense send, otherwise 1h


def enqueue_mass_email_records(email_config):
    """
    Creates a email job and enqueues email records for users based on query
    """
    job = MassEmailJob.objects.create(email_config=email_config)
    users = get_users_for_config(email_config)

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
    threshold_date = timezone.now() - timedelta(
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
        if value in data:
            rendered = rendered.replace(placeholder, data[value])
    return rendered


class MassEmailSender:

    def __init__(self):
        now = timezone.now()
        self.today = now.date()
        cache_date = self.get_cache_key_date(send_date=now)
        self.cache_key_prefix = f'mass_emails_{cache_date.isoformat()}_email_remaining'

        self.total_records = MassEmailRecord.objects.filter(
            status=EmailStatus.ENQUEUED
        ).count()
        self.configs = MassEmailConfig.objects.annotate(
            enqueued_records_count=Count(
                'jobs__records',
                filter=Q(jobs__records__status=EmailStatus.ENQUEUED),
            )
        ).filter(enqueued_records_count__gt=0)
        logging.info(f'Found {self.total_records} enqueued records')
        self.get_day_limits()

    @staticmethod
    def get_cache_key_date(send_date: datetime) -> datetime | date:
        if getattr(settings, 'MASS_EMAILS_CONDENSE_SEND', False):
            minute_boundary = (send_date.minute // 15) * 15
            return send_date.replace(minute=minute_boundary, second=0, microsecond=0)
        return send_date.date()

    def cache_limit_value(self, email_config: Optional[MassEmailConfig], limit: int):
        if email_config is None:
            self.total_limit = limit
            cache_key = f'{self.cache_key_prefix}_total'
        else:
            self.limits[email_config.id] = limit
            cache_key = f'{self.cache_key_prefix}_{email_config.id}'
        tomorrow = datetime.combine(
            self.today,
            time(0, 0, 0, 0, timezone.get_current_timezone())
        ) + timedelta(days=1)
        timedelta_to_midnight = tomorrow - timezone.now()
        TTL = timedelta_to_midnight.total_seconds()
        if getattr(settings, 'MASS_EMAILS_CONDENSE_SEND', None):
            TTL = 15 * 60

        cache.set(cache_key, limit, TTL)

    def get_config_limit(
        self,
        email_config: MassEmailConfig,
        current_total: int,
        total_records_by_type: dict[Enum, int],
        limit_by_type: dict[Enum, int],
    ) -> int:
        """
        Determine the number of emails to be sent for the given config

        :param email_config: MassEmailConfig
        :param current_total: Total limits already calculated (for both types)
        :param total_records_by_type: Total enqueued records for all sends
        :param limit_by_type: Send limits for recurring and one-time sends
        """
        email_type = email_config.type
        total_records = total_records_by_type[email_type]
        limit = limit_by_type[email_type]
        if total_records_by_type[email_type] < limit_by_type[email_type]:
            return email_config.enqueued_records_count
        config_limit = ceil(email_config.enqueued_records_count / total_records * limit)

        if current_total + config_limit > settings.MAX_MASS_EMAILS_PER_DAY:
            config_limit = settings.MAX_MASS_EMAILS_PER_DAY - current_total
        return config_limit

    def get_day_limits(self):
        MAX_EMAILS = settings.MAX_MASS_EMAILS_PER_DAY
        self.limits = {}
        self.total_limit = cache.get(f'{self.cache_key_prefix}_total')

        if self.total_limit is not None:
            for email_config in self.configs:
                stored_limit = cache.get(f'{self.cache_key_prefix}_{email_config.id}')
                self.limits[email_config.id] = stored_limit
        else:
            logging.info('Setting up MassEmailConfig limits for the current day')
            # if the total number of emails to be sent is < MAX allowed, just
            # send all emails
            if self.total_records < MAX_EMAILS:
                for email_config in self.configs:
                    self.cache_limit_value(
                        email_config, email_config.enqueued_records_count
                    )
                self.cache_limit_value(None, self.total_records)
            else:
                # divide configs into daily sends and one-time sends
                recurring_emails = [
                    email_config
                    for email_config in self.configs
                    if email_config.frequency > -1
                ]
                total_recurring_records = sum(
                    email_config.enqueued_records_count
                    for email_config in recurring_emails
                )
                one_time_sends = [
                    email_config
                    for email_config in self.configs
                    if email_config.frequency == -1
                ]
                total_one_time_records = sum(
                    email_config.enqueued_records_count
                    for email_config in one_time_sends
                )
                total_records_by_type = {
                    EmailType.RECURRING: total_recurring_records,
                    EmailType.ONE_TIME: total_one_time_records,
                }
                max_available_by_type = {
                    EmailType.RECURRING: MAX_EMAILS,
                    EmailType.ONE_TIME: max(MAX_EMAILS - total_recurring_records, 0),
                }

                day_limit = 0
                # recurring sends get priority. limits are allotted proportionally
                # with the total number of recurring emails to be sent
                for email_config in recurring_emails:
                    if day_limit >= MAX_EMAILS:
                        break
                    config_limit = self.get_config_limit(
                        email_config,
                        day_limit,
                        total_records_by_type,
                        max_available_by_type,
                    )
                    self.cache_limit_value(email_config, config_limit)
                    day_limit += config_limit
                # if there is still capacity, divide the remaining number of emails
                # allowed among the one-time sends using the same system
                if day_limit < MAX_EMAILS:
                    for email_config in one_time_sends:
                        if day_limit >= MAX_EMAILS:
                            break
                        config_limit = self.get_config_limit(
                            email_config,
                            day_limit,
                            total_records_by_type,
                            max_available_by_type,
                        )
                        self.cache_limit_value(email_config, config_limit)
                        day_limit += config_limit
                self.cache_limit_value(None, MAX_EMAILS)

    def get_plan_name(self, org_user: OrganizationUser) -> str:
        plan_name = None
        if settings.STRIPE_ENABLED:
            plan_name = get_plan_name(org_user)
        if plan_name is None:
            plan_name = gettext('Not available')
        return plan_name

    def send_day_emails(self):
        emails_sent = 0
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
            batch_size = settings.MASS_EMAIL_THROTTLE_PER_SECOND
            for record in records:
                if emails_sent > 0 and emails_sent % batch_size == 0:
                    logging.info(f'sleeping for {settings.MASS_EMAIL_SLEEP_SECONDS}')
                    sleep(settings.MASS_EMAIL_SLEEP_SECONDS)
                self.cache_limit_value(email_config, self.limits[email_config.id] - 1)
                self.cache_limit_value(None, self.total_limit - 1)
                self.send_email(email_config, record)
                emails_sent += 1

    def send_email(self, email_config, record):
        logging.info(f'Processing MassEmailRecord({record})')
        org_user = record.user.organization.organization_users.get(user=record.user)
        plan_name = self.get_plan_name(org_user)
        data = {
            'username': record.user.username,
            'full_name': record.user.extra_details.data.get('name', None),
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
            logging.exception(f'Error when attempting to send record {record}: {e}')
            sent = False
        if sent:
            record.status = EmailStatus.SENT
        else:
            record.status = EmailStatus.FAILED

        record.save()


@celery_app.task(
    time_limit=TASK_TIMEOUT - 2, soft_time_limit=TASK_TIMEOUT - 2
)  # subtract 2 so we don't run in to the generate_send task
def send_emails():
    """
    Send the emails for the current day. It schedules the emails if they have not
    been scheduled yet.
    """
    today = timezone.now()
    cache_key_date = MassEmailSender.get_cache_key_date(today)
    cache_key = PROCESSED_EMAILS_CACHE_KEY.format(key_date=cache_key_date)
    cached_data = cache.get(cache_key, None)
    if cached_data is None:
        logging.info(
            'Skipping send emails task because we have not yet generated send lists'
        )
        return

    sender = MassEmailSender()
    sender.send_day_emails()
    finished_one_offs = (
        MassEmailConfig.objects.filter(frequency=-1, live=True)
        .values('id')
        .annotate(
            enqueued_count=Count(
                'pk', filter=Q(jobs__records__status=EmailStatus.ENQUEUED)
            )
        )
        .filter(enqueued_count=0)
    ).values_list('pk', flat=True)
    MassEmailConfig.objects.filter(pk__in=finished_one_offs).update(live=False)


def get_users_for_config(email_config):
    """
    Get users based on query, excluding recent recipients

    frequency = -1: One time email
    frequency = 1: Daily emails
    frequency > 1: Recurring emails
    """
    now = timezone.now()
    users = USER_QUERIES.get(email_config.query, lambda: [])()
    if email_config.frequency == -1:
        return users
    day_boundary = MassEmailSender.get_cache_key_date(now)

    cutoff_date = day_boundary - timedelta(days=email_config.frequency - 1)
    if getattr(settings, 'MASS_EMAILS_CONDENSE_SEND', False):
        # if we're condensing sends, pretend 15 minutes is a day
        delta = (email_config.frequency-1)*15
        cutoff_date = day_boundary - timedelta(minutes=delta)

    recent_recipients = set(
        MassEmailRecord.objects.filter(
            email_job__email_config=email_config,
            date_modified__gte=cutoff_date
        ).values_list('user_id', flat=True)
    )
    return [user for user in users if user.id not in recent_recipients]


@celery_app.task(time_limit=TASK_TIMEOUT, soft_time_limit=TASK_TIMEOUT)
def generate_mass_email_user_lists():
    """
    Generates daily user lists for MassEmailConfigs, skipping already processed
    configs and users
    """

    today = timezone.now()
    cache_key_date = MassEmailSender.get_cache_key_date(today)
    cache_key = PROCESSED_EMAILS_CACHE_KEY.format(key_date=cache_key_date)
    cached_data = cache.get(cache_key, [])
    processed_configs = set(cached_data)
    email_configs = MassEmailConfig.objects.filter(
        date_created__lt=cache_key_date, live=True
    )
    if len(cached_data) > 0:
        logging.info('Already enqueued records for today.')
        return

    for email_config in email_configs:
        email_records = MassEmailRecord.objects.filter(
            email_job__email_config=email_config,
        )

        # Skip processing emails that have already been enqueued
        if email_records.filter(status=EmailStatus.ENQUEUED).exists():
            logging.info(
                f'Skipping email config {email_config.id} as it already has '
                f'enqueued records.'
            )
            processed_configs.add(email_config.id)

        else:
            try:
                with transaction.atomic():
                    enqueue_mass_email_records(email_config)
            except IntegrityError:
                logging.warning(
                    f'Skipping duplicate record for config: {email_config.id}'
                )
                continue
            processed_configs.add(email_config.id)
    cache.set(cache_key, list(processed_configs), timeout=60*60*24)
    logging.info(f'Processed {len(processed_configs)} email configs for {today}')
