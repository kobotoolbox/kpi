from celery import shared_task

from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files
from kpi.maintenance_tasks import remove_old_assetsnapshots


@shared_task
def perform_maintenance():
    """
    Run daily maintenance tasks
    """
    remove_unused_markdown_files()
    remove_old_assetsnapshots()
