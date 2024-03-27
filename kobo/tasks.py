from celery import shared_task

from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files


@shared_task
def perform_maintenance():
    """
    Run daily maintenance tasks
    """
    remove_unused_markdown_files()
