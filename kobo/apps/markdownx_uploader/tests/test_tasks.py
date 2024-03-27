from django.core.files.uploadedfile import SimpleUploadedFile
from model_bakery import baker

from kobo.apps.markdownx_uploader.models import (
    MarkdownxUploaderFile,
    MarkdownxUploaderFileReference,
)
from kobo.apps.markdownx_uploader.tasks import remove_unused_markdown_files
from kpi.tests.kpi_test_case import BaseTestCase


class MarkdownXUploaderTasksTestCase(BaseTestCase):
    def test_remove_unused_markdown_files(self):
        used_file_content = SimpleUploadedFile('used_file.txt', b'file content')
        unused_file_content = SimpleUploadedFile(
            'file_not_used.txt', b'file content'
        )
        used_file = baker.make(
            MarkdownxUploaderFile,
            content=used_file_content,
        )
        baker.make(MarkdownxUploaderFileReference, file=used_file)
        baker.make(
            MarkdownxUploaderFile,
            content=unused_file_content,
            _quantity=9,
        )
        assert MarkdownxUploaderFile.objects.count() == 10

        with self.assertNumQueries(2):
            remove_unused_markdown_files()

        assert MarkdownxUploaderFile.objects.count() == 1
        assert 'used_file' in MarkdownxUploaderFile.objects.first().content.name

        # TODO: Find way to set up test media storage so this isn't necessary
        MarkdownxUploaderFile.objects.first().delete()
