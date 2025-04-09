import logging

from celery.signals import task_failure, task_retry
from django.conf import settings
from django.db import transaction
from django_celery_beat.models import (
    PeriodicTask,
)

from kobo.celery import celery_app
from kpi.exceptions import KobocatCommunicationError
from ..exceptions import TrashTaskInProgressError
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.project import ProjectTrash
from ..utils import delete_asset


@celery_app.task(
    autoretry_for=(
        TrashTaskInProgressError,
        KobocatCommunicationError,
    ),
    retry_backoff=60,
    retry_backoff_max=600,
    max_retries=5,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def empty_project(project_trash_id: int, force: bool = False):
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        if not force and project_trash.status == TrashStatus.IN_PROGRESS:
            logging.warning(
                f'Project {project_trash.asset.name} deletion is already '
                f'in progress'
            )
            return

        project_trash.status = TrashStatus.IN_PROGRESS
        project_trash.save(update_fields=['status', 'date_modified'])

    delete_asset(project_trash.request_author, project_trash.asset)
    PeriodicTask.objects.get(pk=project_trash.periodic_task_id).delete()
    logging.info(
        f'Project {project_trash.asset.name} (#{project_trash.asset.uid}) has '
        f'been successfully deleted!'
    )


@task_failure.connect(sender=empty_project)
def empty_project_failure(sender=None, **kwargs):

    exception = kwargs['exception']
    project_trash_id = kwargs['args'][0]
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        project_trash.metadata['failure_error'] = str(exception)
        project_trash.status = TrashStatus.FAILED
        project_trash.save(update_fields=['status', 'metadata', 'date_modified'])


@task_retry.connect(sender=empty_project)
def empty_project_retry(sender=None, **kwargs):
    project_trash_id = kwargs['request'].get('args')[0]
    exception = str(kwargs['reason'])
    with transaction.atomic():
        project_trash = AccountTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        project_trash.metadata['failure_error'] = str(exception)
        project_trash.status = TrashStatus.RETRY
        project_trash.save(update_fields=['status', 'metadata', 'date_modified'])
