import logging

from django.db import transaction
from django_celery_beat.models import PeriodicTasks
from celery.signals import task_failure

from kobo.celery import celery_app
from .models.project_trash import ProjectTrash, ProjectTrashStatus


@celery_app.task
def empty_trash(project_trash_id: int):
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        if project_trash.status == ProjectTrashStatus.IN_PROGRESS:
            logging.warning(
                f'Project {project_trash.asset.name} deletion is already '
                f'in progress'
            )
            # return

        project_trash.status = ProjectTrashStatus.IN_PROGRESS
        project_trash.save(update_fields=['status'])

    # Delete submissions
    # delete asset
    with transaction.atomic():
        periodic_task_id = project_trash.periodic_task_id
        project_trash.delete()
        # PeriodicTask.objects.get

        1 / 0
        # Force refresh all periodic tasks
        PeriodicTasks.update_changed()


@task_failure.connect(sender=empty_trash)
def empty_trash_failure(sender=None, **kwargs):

    PeriodicTasks.update_changed()

    exception = kwargs['exception']
    project_trash_id = kwargs['args'][0]
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        project_trash.metadata['failure_error'] = str(exception)
        project_trash.status = ProjectTrashStatus.FAILED
        project_trash.save(update_fields=['status', 'metadata'])


@celery_app.task
def garbage_collector():
    # Do something with IN_progress for more than X hours
    # Delete complete
    pass
