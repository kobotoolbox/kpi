from datetime import timedelta

from celery.signals import task_failure, task_retry
from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from constance import config
from django.apps import apps
from django.conf import settings
from django.utils import timezone

from kobo.celery import celery_app
from .exceptions import AsyncTaskException
from .models.choices import TransferStatusChoices, TransferStatusTypeChoices
from .utils import move_attachments, move_media_files, rewrite_mongo_userform_id


@celery_app.task(
    acks_late=True,
    autoretry_for=(
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
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

    if transfer.status != TransferStatusChoices.IN_PROGRESS.value:
        raise AsyncTaskException(f'`{transfer}` is not in progress')

    TransferStatus.update_status(
        transfer_id=transfer_id,
        status=TransferStatusChoices.IN_PROGRESS.value,
        status_type=async_task_type,
    )

    if async_task_type == TransferStatusTypeChoices.ATTACHMENTS.value:
        move_attachments(transfer)
    elif async_task_type == TransferStatusTypeChoices.MEDIA_FILES.value:
        move_media_files(transfer)
    elif async_task_type == TransferStatusTypeChoices.SUBMISSIONS.value:
        rewrite_mongo_userform_id(transfer)
        # Attachments cannot be moved before `_userform_id` is updated for
        # each submission
        async_task.delay(transfer_id, TransferStatusTypeChoices.ATTACHMENTS.value)
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
            status=TransferStatusChoices.IN_PROGRESS.value,
            status_type=async_task_type,
            error=error,
        )
    else:
        TransferStatus.update_status(
            transfer_id=transfer_id,
            status=TransferStatusChoices.FAILED.value,
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
       transfer_id, TransferStatusChoices.FAILED.value, async_task_type, error
    )


@celery_app.task
def task_scheduler():
    """
    This task restarts previous tasks which have been stopped accidentally,
    e.g.: docker container/k8s pod restart or OOM killed.

    FIXME `ack_late=True` would have been a better (more reliable) option, i.e.:
        delegate to celery internal mechanism to restart tasks itself.
        Unfortunately, it does not seem to work as a parameter of @celery_app.task
        decorator (it is ignored), but as a global setting - which would have
        affect all celery tasks across the app.
    TODO Use username to detect uncompleted tasks
    """
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
        status=TransferStatusChoices.IN_PROGRESS.value,
    ).exclude(status_type=TransferStatusTypeChoices.GLOBAL.value):
        async_task.delay(
            transfer_status.transfer.pk, transfer_status.status_type
        )


@celery_app.task
def garbage_collector():
    """
    Flag tasks as failed if they have been created for a long time
    """
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    stuck_threshold = timezone.now() - timedelta(
        minutes=config.PROJECT_OWNERSHIP_STUCK_THRESHOLD
    )

    # Stop hung tasks
    for transfer_status in TransferStatus.objects.filter(
        date_created__lte=stuck_threshold,
        status=TransferStatusChoices.IN_PROGRESS.value,
    ).exclude(status_type=TransferStatusTypeChoices.GLOBAL.value):
        TransferStatus.update_status(
            transfer_id=transfer_status.transfer.pk,
            status=TransferStatusChoices.FAILED.value,
            status_type=transfer_status.status_type,
            error=(
                f'Task has been stuck for more than {stuck_threshold} minutes',
            )
        )

    # TODO remove old completed transfers
