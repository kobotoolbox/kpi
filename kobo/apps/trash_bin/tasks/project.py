import logging

from celery.signals import task_failure, task_retry
from django.conf import settings

from kobo.celery import celery_app
from ..exceptions import TrashTaskInProgressError
from ..models.project import ProjectTrash
from ..utils import (
    delete_asset,
    process_deletion,
    trash_bin_task_failure,
    trash_bin_task_retry,
)


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
def empty_project(project_trash_id: int, force: bool = False):
    project_trash, success = process_deletion(
        ProjectTrash,
        project_trash_id,
        deletion_callback=_deletion_callback,
        force=force,
    )
    asset = project_trash.asset
    if not success:
        logging.warning(
            f'Project `{asset.name}` (#{asset.uid}) deletion is '
            f'already in progress'
        )
    else:
        logging.info(
            f'Project `{asset.name}` (#{asset.uid}) has been successfully deleted!'
        )


@task_failure.connect(sender=empty_project)
def empty_project_failure(sender=None, **kwargs):
    trash_bin_task_failure(ProjectTrash, **kwargs)


@task_retry.connect(sender=empty_project)
def empty_project_retry(sender=None, **kwargs):
    trash_bin_task_retry(ProjectTrash, **kwargs)


def _deletion_callback(project_trash: ProjectTrash):
    """
    Deletion callback for a project trash object.

    This wrapper extracts the necessary arguments from the trash object
    and delegates the deletion to the actual `delete_asset()` function.
    """
    delete_asset(project_trash.request_author, project_trash.asset)
