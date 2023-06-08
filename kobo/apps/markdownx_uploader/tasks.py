from django.core.files.storage import default_storage

from kobo.celery import celery_app
from .models import MarkdownxUploaderFile, MarkdownxUploaderFileReference


@celery_app.task
def remove_unused_markdown_files():
    """
    Clean-up unused files uploaded via markdown editor
    """
    queryset = MarkdownxUploaderFile.objects.exclude(
        pk__in=MarkdownxUploaderFileReference.objects.values_list(
            'file_id', flat=True
        )
    )

    files = list(queryset.values_list('content', flat=True))
    for file in files:
        default_storage.delete(file)

    queryset.delete()
