from celery.signals import task_failure, task_retry
from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.apps import apps
from django.conf import settings

from kobo.celery import celery_app
from .exceptions import AsyncTaskException
from .models.transfer import TransferAsyncTask, TransferStatus
from .utils import move_attachments, move_media_files, rewrite_mongo_userform_id


@celery_app.task(
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
    transfer = Transfer.objects.get(pk=transfer_id)

    if transfer.status != TransferStatus.IN_PROGRESS.value:
        raise AsyncTaskException(f'`{transfer}` is not in progress')

    if async_task_type == TransferAsyncTask.ATTACHMENTS.value:
        move_attachments(transfer)
    elif async_task_type == TransferAsyncTask.SUBMISSIONS.value:
        rewrite_mongo_userform_id(transfer)
    elif async_task_type == TransferAsyncTask.MEDIA_FILES.value:
        move_media_files(transfer)
    else:
        raise NotImplementedError(f'`{async_task_type}` is not supported')


@task_failure.connect(sender=async_task)
def async_task_failure(sender=None, **kwargs):
    # Avoid circular import
    Transfer = apps.get_model('project_ownership', 'Transfer')  # noqa

    exception = str(kwargs['exception'])
    transfer_id = kwargs['args'][0]
    async_task_type = kwargs['args'][1]
    Transfer.update_statuses(
        transfer_id, TransferStatus.FAILED.value, async_task_type, exception
    )


@task_retry.connect(sender=async_task)
def async_task_retry(sender=None, **kwargs):
    # This may be useless because errors can be overwritten at a later retry, but
    # it could help to debug if something breaks before retry

    # Avoid circular import
    Transfer = apps.get_model('project_ownership', 'Transfer')  # noqa

    transfer_id = kwargs['request'].get('args')[0]
    async_task_type = kwargs['request'].get('args')[1]
    exception = str(kwargs['reason'])

    Transfer.update_statuses(
        transfer_id, TransferStatus.IN_PROGRESS.value, async_task_type, exception
    )


@celery_app.task
def garbage_collector():
    pass
