from datetime import date, datetime, time, timedelta
from enum import Enum
from math import ceil
from time import sleep
from typing import Optional

from celery.exceptions import SoftTimeLimitExceeded
from constance import config
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from django.utils.translation import gettext

from kobo.apps.mass_emails.models import (
    EmailStatus,
    EmailType,
    MassEmailConfig,
    MassEmailJob,
    MassEmailRecord,
)
from kobo.apps.organizations.models import OrganizationUser
from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.mailer import (
    EmailMessage,
    Mailer,
    is_connection_alive,
    reset_connection,
    with_smtp_connection,
)

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
# Reserve a few seconds between the soft and hard time limits of `send_emails`
# so a run that hits the soft limit mid-send has time to close the SMTP
# connection gracefully instead of being SIGKILLed with the socket still open.
SEND_EMAILS_SOFT_LIMIT_BUFFER = 10


def enqueue_mass_email_records(email_config):
    """
    Creates a email job and enqueues email records for users based on query
    """
    job = MassEmailJob.objects.create(email_config=email_config)
    user_ids = get_users_for_config(email_config)
    # edge case: if a one-off email has no recipients, store a warning and turn
    # it off
    if len(user_ids) == 0 and email_config.type == EmailType.ONE_TIME:
        logging.warning(
            f'No recipients found for one-time email config'
            f' {email_config.uid}: {email_config.name}. Turning it off.'
        )
        email_config.live = False
        email_config.save()

    # Instantiating millions of unsaved MassEmailRecord objects at once is ~1 GB,
    # so build and insert them in batches instead.
    batch_size = max(1, settings.USAGE_QUERY_USER_ID_BATCH_SIZE)
    total_created = 0
    for start_idx in range(0, len(user_ids), batch_size):
        end_idx = start_idx + batch_size
        records = [
            MassEmailRecord(user_id=user_id, email_job=job, status=EmailStatus.ENQUEUED)
            for user_id in user_ids[start_idx:end_idx]
        ]
        MassEmailRecord.objects.bulk_create(records, batch_size=batch_size)
        total_created += len(records)

    logging.info(
        f'Created {total_created} MassEmailRecord(s) for {email_config.name} '
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
        self.connection = None
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
        # store separately so we know which config ids we looked at even though the
        # self.configs will mutate after the fact as emails are sent
        self.config_ids = list(self.configs.values_list('id', flat=True))
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

    @with_smtp_connection
    def send_day_emails(self):
        emails_sent = 0

        batch_size = settings.MASS_EMAIL_THROTTLE_PER_SECOND

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
            sent = Mailer.send(message, connection=self.connection)
            if not sent and self.connection is not None:
                # `Mailer.send()` reports any SMTP error as a plain `False`, so
                # probe the socket to tell a dropped connection apart from a
                # message the server simply refused. Only the former is worth
                # reconnecting for, and it would otherwise fail every remaining
                # record of the run.
                #
                # Don't resend this particular message on the fresh
                # connection: a dropped connection can happen right after the
                # server already accepted the message but before we read its
                # acknowledgement, so we can't tell a lost send apart from a
                # lost confirmation. Resending would risk a duplicate. Just
                # reconnect for the records still to come and report this one
                # failed, same as before the connection was reused across the
                # whole run.
                if not is_connection_alive(self.connection):
                    logging.warning('SMTP connection lost, reconnecting')
                    reset_connection(self.connection)
        except SoftTimeLimitExceeded:
            # Let this propagate: it must not be recorded as a failure. The
            # record stays `enqueued` and is picked up by the next run.
            raise
        except Exception as e:
            logging.exception(f'Error when attempting to send record {record}: {e}')
            sent = False
        if sent:
            record.status = EmailStatus.SENT
        else:
            record.status = EmailStatus.FAILED

        record.save()


@celery_app.task(
    time_limit=TASK_TIMEOUT - 2,
    soft_time_limit=TASK_TIMEOUT - 2 - SEND_EMAILS_SOFT_LIMIT_BUFFER,
)  # subtract 2 from time_limit so this run finishes before the next
# `generate_mass_email_user_lists` run, scheduled 59 minutes later
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
    try:
        sender.send_day_emails()
    except SoftTimeLimitExceeded:
        # Expected under load: the run is capped by design and the remaining
        # `enqueued` records are simply picked up by the next hourly run.
        logging.warning(
            'send_emails hit its soft time limit, stopping early; remaining '
            'enqueued records will be sent on the next run'
        )
    finished_one_offs = (
        MassEmailConfig.objects.filter(
            pk__in=sender.config_ids, frequency=-1, live=True
        )
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
    Get user ids based on query, excluding recent recipients

    frequency = -1: One time email
    frequency = 1: Daily emails
    frequency > 1: Recurring emails
    """
    now = timezone.now()
    users = email_config.get_users_queryset()
    # `get_users_queryset()` returns a QuerySet for real queries but a plain list
    # (e.g. `[]`) from the default fallback; normalize to a list of ids without
    # materializing full User instances.
    if isinstance(users, QuerySet):
        user_ids = list(users.values_list('id', flat=True))
    else:
        user_ids = [getattr(user, 'id', user) for user in users]

    if email_config.frequency == -1:
        return user_ids
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
    return [user_id for user_id in user_ids if user_id not in recent_recipients]


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
