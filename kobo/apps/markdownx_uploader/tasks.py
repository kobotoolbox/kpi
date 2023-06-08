from kobo.celery import celery_app

from .models import MarkdownxUploaderFile, MarkdownxUploaderFileReference


@celery_app.task
def remove_unused_markdown_files():
    """
    Clean-up unused files uploaded via markdown editor
    """
    MarkdownxUploaderFile.objects.exclude(
        pk__in=MarkdownxUploaderFileReference.objects.values_list(
            'file_id', flat=True
        )
    ).delete()
