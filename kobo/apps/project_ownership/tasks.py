from datetime import timedelta

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure, task_retry
from constance import config
from django.apps import apps
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext as t

from kobo.celery import celery_app
from kpi.utils.mailer import EmailMessage, Mailer
from .exceptions import AsyncTaskException, TransferStillPendingException
from .models.choices import (
    InviteStatusChoices,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from .utils import move_attachments, move_media_files, rewrite_mongo_userform_id


@celery_app.task(
    autoretry_for=(
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
        TransferStillPendingException,
    ),
    max_retry=5,
    retry_backoff=60,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def async_task(transfer_id: int, async_task_type: str):
    # Avoid circular import
    Transfer = apps.get_model('project_ownership', 'Transfer')  # noqa
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa

    transfer = Transfer.objects.get(pk=transfer_id)

    if transfer.status == TransferStatusChoices.PENDING:
        # Sometimes, a race condition occurs: the Celery task starts, but
        # `transfer.status` has not been updated fast enough.
        # Raise an exception which allows retry.
        raise TransferStillPendingException

    if transfer.status != TransferStatusChoices.IN_PROGRESS:
        raise AsyncTaskException(f'`{transfer}` is not in progress: {transfer.status}')

    TransferStatus.update_status(
        transfer_id=transfer_id,
        status=TransferStatusChoices.IN_PROGRESS,
        status_type=async_task_type,
    )

    if async_task_type == TransferStatusTypeChoices.ATTACHMENTS:
        move_attachments(transfer)
    elif async_task_type == TransferStatusTypeChoices.MEDIA_FILES:
        move_media_files(transfer)
    elif async_task_type == TransferStatusTypeChoices.SUBMISSIONS:
        rewrite_mongo_userform_id(transfer)
        # Attachments cannot be moved before `_userform_id` is updated for
        # each submission
        async_task.delay(transfer_id, TransferStatusTypeChoices.ATTACHMENTS)
    else:
        raise NotImplementedError(f'`{async_task_type}` is not supported')


@task_failure.connect(sender=async_task)
def async_task_failure(sender=None, **kwargs):
    # Avoid circular import
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa

    async_task_type = kwargs['args'][1]
    error = str(kwargs['exception'])
    transfer_id = kwargs['args'][0]

    if 'SIGKILL' in error:
        # We want the process to recover if it is killed
        TransferStatus.update_status(
            transfer_id=transfer_id,
            status=TransferStatusChoices.IN_PROGRESS,
            status_type=async_task_type,
            error=error,
        )
    else:
        TransferStatus.update_status(
            transfer_id=transfer_id,
            status=TransferStatusChoices.FAILED,
            status_type=async_task_type,
            error=error,
        )


@task_retry.connect(sender=async_task)
def async_task_retry(sender=None, **kwargs):
    # This may be useless because errors can be overwritten at a later retry, but
    # it could help to debug if something breaks before retry

    # Avoid circular import
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa

    async_task_type = kwargs['request'].get('args')[1]
    error = str(kwargs['reason'])
    transfer_id = kwargs['request'].get('args')[0]

    TransferStatus.update_status(
       transfer_id, TransferStatusChoices.FAILED, async_task_type, error
    )


@celery_app.task
def garbage_collector():
    """
    Delete obsolete invites (except failed one)
    """
    # Avoid circular import
    Invite = apps.get_model('project_ownership', 'Invite')  # noqa

    # Keep failed invites forever for debugging purpose.
    deletion_threshold = timezone.now() - timedelta(
        days=config.PROJECT_OWNERSHIP_INVITE_HISTORY_RETENTION
    )
    Invite.objects.filter(date_created__lte=deletion_threshold).exclude(
        status=InviteStatusChoices.FAILED
    ).delete()


@celery_app.task
def mark_as_expired():
    """
    Flag as expired not accepted (or declined) invites after
    """
    # Avoid circular import
    Invite = apps.get_model('project_ownership', 'Invite')  # noqa
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa

    expiry_threshold = timezone.now() - timedelta(
        days=config.PROJECT_OWNERSHIP_INVITE_EXPIRY
    )

    invites_to_update = []
    transfer_statuses_to_update = []
    for invite in Invite.objects.filter(
        date_created__lte=expiry_threshold,
        status=InviteStatusChoices.PENDING,
    ):
        invite.status = InviteStatusChoices.EXPIRED
        invites_to_update.append(invite)
        # Mark transfers as cancelled
        for transfer in invite.transfers.all():
            for transfer_status in transfer.statuses.all():
                transfer_status.status = TransferStatusChoices.CANCELLED
                transfer_statuses_to_update.append(transfer_status)

    if not invites_to_update:
        return

    # Notify senders
    TransferStatus.objects.bulk_update(transfer_statuses_to_update, fields=['status'])
    Invite.objects.bulk_update(invites_to_update, fields=['status'])
    email_messages = []

    for invite in invites_to_update:
        template_variables = {
            'username': invite.sender.username,
            'recipient': invite.recipient.username,
            'transfers': [
                {
                    'asset_uid': transfer.asset.uid,
                    'asset_name': transfer.asset.name,
                }
                for transfer in invite.transfers.all()
            ],
            'base_url': settings.KOBOFORM_URL,
        }
        email_messages.append(
            EmailMessage(
                to=invite.sender.email,
                subject=t('Invite has expired'),
                plain_text_content_or_template='emails/expired_invite.txt',
                template_variables=template_variables,
                html_content_or_template='emails/expired_invite.html',
                language=invite.sender.extra_details.data.get('last_ui_language')
            )
        )

    Mailer.send(email_messages)


@celery_app.task
def mark_stuck_tasks_as_failed():
    """
    Flag tasks as failed if they have been created for a long time.
    """
    # Avoid circular import
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    stuck_threshold = timezone.now() - timedelta(
        minutes=config.PROJECT_OWNERSHIP_STUCK_THRESHOLD
    )

    for transfer_status in TransferStatus.objects.filter(
        date_created__lte=stuck_threshold,
        status=TransferStatusChoices.IN_PROGRESS,
    ).exclude(status_type=TransferStatusTypeChoices.GLOBAL):
        TransferStatus.update_status(
            transfer_id=transfer_status.transfer.pk,
            status=TransferStatusChoices.FAILED,
            status_type=transfer_status.status_type,
            error=(
                f'Task has been stuck for more than {stuck_threshold} minutes',
            )
        )


@celery_app.task
def send_email_to_admins(invite_uid: str):
    """
    Send failure reports to admins
    """
    admin_emails = config.PROJECT_OWNERSHIP_ADMIN_EMAIL.strip()
    if not admin_emails:
        return

    invite_url = settings.KOBOFORM_URL + reverse(
        'api_v2:project-ownership-invite-detail', args=(invite_uid,)
    )

    email_message = EmailMessage(
        to=admin_emails.split('\n'),
        subject=config.PROJECT_OWNERSHIP_ADMIN_EMAIL_SUBJECT.strip(),
        plain_text_content_or_template=(
            config.PROJECT_OWNERSHIP_ADMIN_EMAIL_BODY.replace(
                '##invite_url##', invite_url
            )
        ),
    )

    Mailer.send(email_message)


@celery_app.task
def task_rescheduler():
    """
    This task restarts previous tasks which have been stopped accidentally,
    e.g.: docker container/k8s pod restart or OOM killed.

    FIXME `ack_late=True` would have been a better (more reliable) option, i.e.:
        delegate to celery internal mechanism to restart tasks itself.
        Unfortunately, it does not seem to work as a parameter of @celery_app.task
        decorator (it is ignored), but as a global setting - which would have
        affected all celery tasks across the app.
    """
    # Avoid circular import
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    resume_threshold = timezone.now() - timedelta(
        minutes=config.PROJECT_OWNERSHIP_RESUME_THRESHOLD
    )
    stuck_threshold = timezone.now() - timedelta(
        minutes=config.PROJECT_OWNERSHIP_STUCK_THRESHOLD
    )

    # Resume stopped involuntarily tasks
    for transfer_status in TransferStatus.objects.filter(
        date_modified__lte=resume_threshold,
        date_created__gt=stuck_threshold,
        status=TransferStatusChoices.IN_PROGRESS,
    ).exclude(status_type=TransferStatusTypeChoices.GLOBAL):
        async_task.delay(
            transfer_status.transfer.pk, transfer_status.status_type
        )
