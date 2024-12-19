import re

from django.db import models, transaction
from private_storage.fields import PrivateFileField


class AbstractMarkdownxModel(models.Model):

    markdown_fields = []

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            content = ''
            for field in self.markdown_fields:
                content += f'{getattr(self, field)}\n'

            MarkdownxUploaderFileReference.update_ref(
                self._meta.app_label, self._meta.model_name, self.pk, content
            )

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            object_id = self.pk
            result = super().delete(*args, **kwargs)
            MarkdownxUploaderFileReference.objects.filter(
                app_label=self._meta.app_label,
                model_name=self._meta.model_name,
                object_id=object_id,
            ).delete()

        return result


class MarkdownxUploaderFile(models.Model):
    """
    A file uploaded by the django-markdownx editor. It doesn't have a foreign
    key to models using `Markdownfield`s because it was likely uploaded while
    the message was still being drafted, before ever being saved in the database
    """
    content = PrivateFileField(
        # Avoid collisions with usernames, which must begin with `[a-z]`
        # (see `kpi.forms.USERNAME_REGEX`)
        upload_to='__markdown_media_files/%Y/%m/%d',
        max_length=380,
    )

    def __str__(self):
        return self.content.name


class MarkdownxUploaderFileReference(models.Model):

    file = models.ForeignKey(
        MarkdownxUploaderFile,
        related_name='markdown_fields',
        on_delete=models.CASCADE,
    )
    app_label = models.CharField(db_index=True, max_length=100)
    model_name = models.CharField(db_index=True, max_length=100)
    object_id = models.IntegerField(db_index=True)

    @classmethod
    def update_ref(cls, app_label: str, model_name: str, object_id: int, field: str):

        with transaction.atomic():
            cls.objects.filter(
                app_label=app_label, model_name=model_name, object_id=object_id
            ).delete()

            if results := re.findall(r'!\[\]\(([^\)]+)', field):
                image_paths = []
                for result in results:
                    # image path in markdown use this format:
                    # /<app_label>/<url_prefix>/<filename>
                    # We need only the filename
                    _, _, _, *parts = result.split('/')
                    image_paths.append('/'.join(parts))

                pks = MarkdownxUploaderFile.objects.values_list(
                    'pk', flat=True
                ).filter(content__in=image_paths)

                if pks:
                    cls.objects.bulk_create(
                        [
                            cls(
                                file_id=pk,
                                app_label=app_label,
                                model_name=model_name,
                                object_id=object_id,
                            )
                            for pk in pks
                        ]
                    )
