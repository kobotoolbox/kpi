import logging

from celery.signals import task_failure, task_retry
from django.conf import settings

from kobo.celery import celery_app
from ..exceptions import TrashTaskInProgressError
from ..models.account import AccountTrash
from ..utils import (
    delete_account,
    process_deletion,
    trash_bin_task_failure,
    trash_bin_task_retry,
)
from ..utils.account import validate_pre_deletion


@celery_app.task(
    autoretry_for=(TrashTaskInProgressError,),
    retry_backoff=60,
    retry_backoff_max=600,
    max_retries=5,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def empty_account(account_trash_id: int, force: bool = False):
    account_trash, success = process_deletion(
        AccountTrash,
        account_trash_id,
        deletion_callback=delete_account,
        pre_deletion_callback=validate_pre_deletion,
        force=force,
    )
    user = account_trash.user
    if not success:
        logging.warning(f'User `{user.username}` deletion is already in progress')
    else:
        logging.info(
            f'User `{user.username}` has been successfully deleted!'
        )


@task_failure.connect(sender=empty_account)
def empty_account_failure(sender=None, **kwargs):
    trash_bin_task_failure(AccountTrash, **kwargs)


@task_retry.connect(sender=empty_account)
def empty_account_retry(sender=None, **kwargs):
    trash_bin_task_retry(AccountTrash, **kwargs)
