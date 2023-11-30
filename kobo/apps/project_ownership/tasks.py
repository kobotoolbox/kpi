from celery.signals import task_failure, task_retry
from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from kobo.celery import celery_app
from kpi.utils.django_orm_helper import ReplaceValues
from .exceptions import AsyncTaskException
from .models.transfer import TransferAsyncTask, TransferStatus


@celery_app.task(
    autoretry_for=(
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
        AsyncTaskException,
    ),
    retry_backoff=60,
    retry_backoff_max=600,
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
        pass
    elif async_task_type == TransferAsyncTask.SUBMISSIONS.value:
        pass
    elif async_task_type == TransferAsyncTask.MEDIA_FILES.value:
        pass
    else:
        raise NotImplementedError(f'`{async_task_type}` is not supported')


@task_failure.connect(sender=async_task)
def async_task_failure(sender=None, **kwargs):
    # Avoid circular import
    Transfer = apps.get_model('project_ownership', 'Transfer')  # noqa

    exception = kwargs['exception']
    transfer_id = kwargs['args'][0]
    async_task_type = kwargs['args'][1]
    with transaction.atomic():
        # Lock row to ensure status and errors are logged properly
        transfer = Transfer.objects.select_for_update().get(pk=transfer_id)
        Transfer.objects.filter(pk=transfer_id).update(
            date_modified=timezone.now(),
            status=TransferStatus.FAILED.value,
            errors=ReplaceValues(
                'errors',
                updates={async_task_type: exception}
            ),
            async_task_statuses=ReplaceValues(
                'async_task_statuses',
                updates={async_task_type: TransferStatus.FAILED.value}
            ),
        )
        transfer.invite.update_status()


@task_retry.connect(sender=async_task)
def async_task_retry(sender=None, **kwargs):
    # This may be useless because errors can be overwritten at a later retry, but
    # it could help to debug if something breaks before retry

    # Avoid circular import
    Transfer = apps.get_model('project_ownership', 'Transfer')  # noqa

    transfer_id = kwargs['request'].get('args')[0]
    async_task_type = kwargs['request'].get('args')[1]
    exception = str(kwargs['reason'])

    with transaction.atomic():
        Transfer.objects.select_for_update().get(pk=transfer_id)
        Transfer.objects.filter(pk=transfer_id).update(
            date_modified=timezone.now(),
            errors=ReplaceValues(
                'errors',
                updates={async_task_type: exception}
            ),
        )


@celery_app.task
def garbage_collector():
    pass
