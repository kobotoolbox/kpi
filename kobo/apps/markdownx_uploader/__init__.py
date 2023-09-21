from django.apps import AppConfig


class MarkdownxUploaderAppConfig(AppConfig):
    name = 'kobo.apps.markdownx_uploader'
    verbose_name = 'Markdown media files'

    def ready(self):
        super().ready()
