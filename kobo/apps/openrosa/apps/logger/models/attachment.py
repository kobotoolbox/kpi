# coding: utf-8
import mimetypes
import os

from django.conf import settings
from django.db import models
from django.utils.http import urlencode

from kobo.apps.openrosa.libs.utils.hash import get_hash
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
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


def hash_attachment_contents(contents):
    return get_hash(contents)


class AttachmentDefaultManager(models.Manager):

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Attachment(models.Model):
    instance = models.ForeignKey(
        Instance, related_name='attachments', on_delete=models.CASCADE
    )
    media_file = models.FileField(
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

    @property
    def file_hash(self):
        if self.media_file.storage.exists(self.media_file.name):
            media_file_position = self.media_file.tell()
            self.media_file.seek(0)
            media_file_hash = hash_attachment_contents(self.media_file.read())
            self.media_file.seek(media_file_position)
            return media_file_hash
        return ''

    @property
    def filename(self):
        return os.path.basename(self.media_file.name)

    def secure_url(self, suffix="original"):
        """
        Returns image URL through kobocat redirector.
        :param suffix: str. original|large|medium|small
        :return: str
        """
        if suffix != "original" and suffix not in settings.THUMB_CONF.keys():
            raise Exception("Invalid image thumbnail")

        return "{kobocat_url}{media_url}{suffix}?{media_file}".format(
            kobocat_url=settings.KOBOCAT_URL,
            media_url=settings.MEDIA_URL,
            suffix=suffix,
            media_file=urlencode({"media_file": self.media_file.name})
        )
