# coding: utf-8
import time

import constance
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import get_template
from django.utils import timezone, translation
from django_celery_beat.models import PeriodicTask

from kobo.celery import celery_app
from kpi.utils.log import logging
from .constants import HOOK_LOG_FAILED
from .exceptions import HookRemoteServerDownError
from .models import Hook, HookLog
from .utils.lazy import LazyMaxRetriesInt


@celery_app.task(
    autoretry_for=(HookRemoteServerDownError,),
    retry_backoff=60,
    retry_backoff_max=1200,
    max_retries=LazyMaxRetriesInt(),
    retry_jitter=True,
    queue='kpi_low_priority_queue',
)
def service_definition_task(hook_id: int, submission_id: int) -> bool:
    """
    Tries to send data to the endpoint of the hook
    It retries n times (n = `constance.config.HOOK_MAX_RETRIES`)
    """
    hook = Hook.objects.get(id=hook_id)
    # Use camelcase (even if it's not PEP-8 compliant)
    # because variable represents the class, not the instance.
    ServiceDefinition = hook.get_service_definition()  # noqa
    service_definition = ServiceDefinition(hook, submission_id)
    return service_definition.send()


@shared_task
def retry_all_task(hooklogs_ids: int):
    hook_logs = HookLog.objects.filter(id__in=hooklogs_ids)
    for hook_log in hook_logs:
        hook_log.retry()
        time.sleep(0.2)

    return True


@shared_task
def failures_reports():
    """
    Notifies owners' assets by email of hooks failures.
    :return: bool
    """
    beat_schedule = settings.CELERY_BEAT_SCHEDULE.get('send-hooks-failures-reports')
    # Use `.first()` instead of `.get()`, because task can be duplicated in admin section

    failures_reports_period_task = (
        PeriodicTask.objects.filter(enabled=True, task=beat_schedule.get('task'))
        .order_by('-last_run_at')
        .first()
    )

    if failures_reports_period_task:

        last_run_at = failures_reports_period_task.last_run_at
        queryset = HookLog.objects.filter(
            hook__email_notification=True, status=HOOK_LOG_FAILED
        )
        if last_run_at:
            queryset = queryset.filter(date_modified__gte=last_run_at)

        queryset = queryset.order_by('hook__asset__name', 'hook__uid', '-date_modified')

        # PeriodicTask are updated every 3 minutes (default).
        # It means, if this task interval is less than 3 minutes, some data can be duplicated in emails.
        # Setting `beat-sync-every` to 1, makes PeriodicTask to be updated before running the task.
        # So, we need to update it manually.
        # see: http://docs.celeryproject.org/en/latest/userguide/configuration.html#beat-sync-every
        PeriodicTask.objects.filter(task=beat_schedule.get('task')).update(
            last_run_at=timezone.now()
        )

        records = {}
        max_length = 0

        # Prepare data for templates.
        # All logs will be grouped under their respective asset and user.
        for record in queryset:
            # if users don't exist in dict, add them
            if record.hook.asset.owner.id not in records:
                records[record.hook.asset.owner.id] = {
                    'username': record.hook.asset.owner.username,
                    # language is not implemented yet.
                    # TODO add language to user table in registration process
                    'language': getattr(record.hook.asset.owner, 'language', 'en'),
                    'email': record.hook.asset.owner.email,
                    'assets': {}
                }

            # if asset doesn't exist in user's asset dict, add it
            if record.hook.asset.uid not in records[record.hook.asset.owner.id]['assets']:
                max_length = 0
                records[record.hook.asset.owner.id]['assets'][record.hook.asset.uid] = {
                    'name': record.hook.asset.name,
                    'hook_uid': record.hook.uid,
                    'max_length': 0,
                    'logs': []
                }

            # Add log to corresponding asset and user
            records[record.hook.asset.owner.id]['assets'][record.hook.asset.uid]['logs'].append({
                'hook_name': record.hook.name,
                'uid': record.uid,
                'date_modified': record.date_modified,
                'status_code': record.status_code,
                'message': record.message
            })
            hook_name_length = len(record.hook.name)

            # Max Length is used for plain text template. To display fixed size columns.
            max_length = max(max_length, hook_name_length)
            records[record.hook.asset.owner.id]['assets'][record.hook.asset.uid]['max_length'] = max_length

        # TODO use kpi.utils.mailer.EmailMessage and kpi.utils.mailer.Mailer
        #  classes to send emails
        # Get templates
        plain_text_template = get_template('reports/failures_email_body.txt')
        html_template = get_template('reports/failures_email_body.html')
        email_messages = []

        for owner_id, record in records.items():
            variables = {
                'username': record.get('username'),
                'assets': record.get('assets'),
                'kpi_base_url': settings.KOBOFORM_URL
            }
            # Localize templates
            translation.activate(record.get('language'))
            text_content = plain_text_template.render(variables)
            html_content = html_template.render(variables)

            msg = EmailMultiAlternatives(
                subject=translation.gettext('REST Services Failure Report'),
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[record.get('email')],
            )
            msg.attach_alternative(html_content, 'text/html')
            email_messages.append(msg)

        # Send email messages
        if len(email_messages) > 0:
            try:
                with get_connection() as connection:
                    connection.send_messages(email_messages)
            except Exception as e:
                logging.error('failures_reports - {}'.format(str(e)), exc_info=True)
                return False

    return True
