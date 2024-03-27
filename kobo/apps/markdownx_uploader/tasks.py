from django.core.files.storage import default_storage

from .models import MarkdownxUploaderFile


def remove_unused_markdown_files():
    """
    Clean-up unused files uploaded via markdown editor
    """
    queryset = MarkdownxUploaderFile.objects.filter(markdown_fields=None)

    files = list(queryset.values_list('content', flat=True))
    for file in files:
        default_storage.delete(file)

    queryset._raw_delete(queryset.db)
