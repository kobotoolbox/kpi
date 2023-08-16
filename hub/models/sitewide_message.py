from django.db import models
from markdownx.models import MarkdownxField


from kobo.apps.markdownx_uploader.models import AbstractMarkdownxModel


class SitewideMessage(AbstractMarkdownxModel):

    slug = models.CharField(max_length=50)
    body = MarkdownxField()

    markdown_fields = ['body']

    def __str__(self):
        return self.slug
