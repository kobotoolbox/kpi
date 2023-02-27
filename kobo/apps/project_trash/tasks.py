import logging
from django.db import transaction

from kobo.celery import celery_app
from .models.project_trash import ProjectTrash, ProjectTrashStatus


@celery_app.task
def empty_trash(project_trash_id: int):
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(pk=project_trash_id)
        if project_trash.status != ProjectTrashStatus.PENDING:
            logging.warning(
                f'Project {project_trash.asset.name} deletion is already '
                f'in progress'
            )
            return

        project_trash.status = ProjectTrashStatus.IN_PROGRESS
        #project_trash.save(update_fields=['status'])

        # Delete submissions
        # Delete asset
        # Mark project_trash as done


@celery_app.task
def garbage_collector():
    # Do something with IN_progress for more than X hours
    # Delete complete
    pass
