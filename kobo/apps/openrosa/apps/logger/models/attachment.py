import mimetypes
import os
from typing import Optional
from urllib.parse import quote as urlquote

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models
from django.utils.http import urlencode

from kobo.apps.openrosa.libs.utils.image_tools import get_optimized_image_path, resize
from kpi.deployment_backends.kc_access.storage import KobocatFileSystemStorage
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.fields.file import ExtendedFileField
from kpi.mixins.audio_transcoding import AudioTranscodingMixin
from kpi.utils.hash import calculate_hash
from .instance import Instance


def generate_attachment_filename(instance, filename):
    xform = instance.xform
    return os.path.join(
        xform.user.username,
        'attachments',
        xform.uuid or xform.id_string or '__pk-{}'.format(xform.pk),
        instance.uuid or '__pk-{}'.format(instance.pk),
        os.path.split(filename)[1])


def upload_to(attachment, filename):
    return generate_attachment_filename(attachment.instance, filename)


class AttachmentDefaultManager(models.Manager):

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Attachment(models.Model, AudioTranscodingMixin):
    instance = models.ForeignKey(
        Instance, related_name='attachments', on_delete=models.CASCADE
    )
    media_file = ExtendedFileField(
        storage=default_storage,
        upload_to=upload_to,
        max_length=380,
        db_index=True,
    )
    media_file_basename = models.CharField(
        max_length=260, null=True, blank=True, db_index=True)
    # `PositiveIntegerField` will only accommodate 2 GiB, so we should consider
    # `PositiveBigIntegerField` after upgrading to Django 3.1+
    media_file_size = models.PositiveIntegerField(blank=True, null=True)
    mimetype = models.CharField(
        max_length=100, null=False, blank=True, default='')
    deleted_at = models.DateTimeField(blank=True, null=True, db_index=True)

    objects = AttachmentDefaultManager()
    all_objects = models.Manager()

    class Meta:
        app_label = 'logger'

    @property
    def absolute_mp3_path(self):
        """
        Return the absolute path on local file system of the converted version of
        attachment. Otherwise, return the AWS url (e.g. https://...)
        """

        if not default_storage.exists(self.mp3_storage_path):
            content = self.get_transcoded_audio('mp3')
            default_storage.save(self.mp3_storage_path, ContentFile(content))

        if isinstance(default_storage, KobocatFileSystemStorage):
            return f'{self.media_file.path}.mp3'

        return default_storage.url(self.mp3_storage_path)

    @property
    def absolute_path(self):
        """
        Return the absolute path on local file system of the attachment.
        Otherwise, return the AWS url (e.g. https://...)
        """
        if isinstance(default_storage, KobocatFileSystemStorage):
            return self.media_file.path

        return self.media_file.url

    @property
    def file_hash(self):
        if self.media_file.storage.exists(self.media_file.name):
            # TODO optimize calculation of hash when using cloud storage.
            #   Instead of reading the whole file, we could pass the url of the
            #   file to build the hash based on headers (e.g.: Etag).
            media_file_position = self.media_file.tell()
            self.media_file.seek(0)
            media_file_hash = calculate_hash(self.media_file.read())
            self.media_file.seek(media_file_position)
            return media_file_hash
        return ''

    @property
    def filename(self):
        return os.path.basename(self.media_file.name)

    @property
    def mp3_storage_path(self):
        """
        Return the path of file after conversion. It is the exact same name, plus
        the conversion audio format extension concatenated.
        E.g: file.mp4 and file.mp4.mp3
        """
        return f'{self.storage_path}.mp3'

    def protected_path(
        self, format_: Optional[str] = None, suffix: Optional[str] = None
    ) -> str:
        """
        Return path to be served as protected file served by NGINX
        """
        if format_ == 'mp3':
            attachment_file_path = self.absolute_mp3_path
        else:
            attachment_file_path = self.absolute_path

        optimized_image_path = None
        if suffix and self.mimetype.startswith('image/'):
            optimized_image_path = get_optimized_image_path(
                self.media_file.name, suffix
            )
            if not default_storage.exists(optimized_image_path):
                resize(self.media_file.name)

        if isinstance(default_storage, KobocatFileSystemStorage):
            # Django normally sanitizes accented characters in file names during
            # save on disk but some languages have extra letters
            # (out of ASCII character set) and must be encoded to let NGINX serve
            # them
            if optimized_image_path:
                attachment_file_path = default_storage.path(optimized_image_path)
            protected_url = urlquote(
                attachment_file_path.replace(settings.KOBOCAT_MEDIA_ROOT, '/protected')
            )
        else:
            # Double-encode the S3 URL to take advantage of NGINX's
            # otherwise troublesome automatic decoding
            if optimized_image_path:
                attachment_file_path = default_storage.url(optimized_image_path)
            protected_url = f'/protected-s3/{urlquote(attachment_file_path)}'

        return protected_url

    def save(self, *args, **kwargs):
        if self.media_file:
            self.media_file_basename = self.filename
            if self.mimetype == '':
                # guess mimetype
                mimetype, encoding = mimetypes.guess_type(self.media_file.name)
                if mimetype:
                    self.mimetype = mimetype
            # Cache the file size in the database to avoid expensive calls to
            # the storage engine when running reports
            self.media_file_size = self.media_file.size

        super().save(*args, **kwargs)

    def secure_url(self, suffix: str = 'original'):
        """
        Returns image URL through KoboCAT redirector.
        :param suffix: str. original|large|medium|small
        :return: str
        """
        if suffix != 'original' and suffix not in settings.THUMB_CONF.keys():
            raise Exception('Invalid image thumbnail')

        return '{kobocat_url}{media_url}{suffix}?{media_file}'.format(
            kobocat_url=settings.KOBOCAT_URL,
            media_url=settings.MEDIA_URL,
            suffix=suffix,
            media_file=urlencode({'media_file': self.media_file.name})
        )

    @property
    def storage_path(self):
        return str(self.media_file)
