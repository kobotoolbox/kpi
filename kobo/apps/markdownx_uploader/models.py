from django.db import models
from private_storage.fields import PrivateFileField


class MarkdownxUploaderFile(models.Model):
    """
    A file uploaded by the django-markdownx editor. It doesn't have a foreign
    key to models using `Markdownfield`s because it was likely uploaded while
    the message was still being drafted, before ever being saved in the database
    """
    content = PrivateFileField(
        # Avoid collisions with usernames, which must begin with `[a-z]`
        # (see `kpi.forms.USERNAME_REGEX`)
        upload_to='__markdown_media_files/%Y/%m/%d'
    )

    def __str__(self):
        return self.content.name
