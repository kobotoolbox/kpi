#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
import sys

from django.core.files.storage import (
    default_storage,
    storages,
    InvalidStorageError,
)
from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.attachment import (
    upload_to as attachment_upload_to,
)
from kobo.apps.openrosa.apps.logger.models.xform import (
    XForm,
    upload_to as xform_upload_to,
)


class Command(BaseCommand):
    help = (
        'Moves all attachments and xls files '
        'to s3 from the local file system storage.'
    )

    def handle(self, *args, **kwargs):
        try:
            fs = storages['local']
            s3 = default_storage
        except InvalidStorageError:
            print(
                'You must first set `KOBOCAT_DEFAULT_FILE_STORAGE` env variable '
                'to `storages.backends.s3boto3.S3Boto3Storage`'
            )
            sys.exit(1)

        classes_to_move = [
            (Attachment, 'media_file', attachment_upload_to),
            (XForm, 'xls', xform_upload_to),
        ]

        for cls, file_field, upload_to in classes_to_move:
            print("Moving %(class)ss to s3..." % {'class': cls.__name__})
            for i in cls.objects.all():
                f = getattr(i, file_field)
                old_filename = f.name
                if f.name and fs.exists(f.name) and not s3.exists(
                        upload_to(i, f.name)):
                    f.save(fs.path(f.name), fs.open(fs.path(f.name)))
                    print("\t+ '%(fname)s'\n\t---> '%(url)s'"
                           % {'fname': fs.path(old_filename), 'url': f.url})
                else:
                    print("\t- (f.name=%s, fs.exists(f.name)=%s, not s3.exist"
                          "s(upload_to(i, f.name))=%s)" % (
                              f.name, fs.exists(f.name),
                              not s3.exists(upload_to(i, f.name))))
