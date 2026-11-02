# coding: utf-8
from __future__ import annotations

import mimetypes
import os
import shutil
import tempfile
import zipfile
from typing import BinaryIO, Union

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import HttpRequest

from kobo.apps.openrosa.apps.logger.xform_fs import XFormInstanceFS
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance

# Any directory tree works: each `.xml` file that starts with `<?xml` is
# imported as a submission, and the other files of its folder become its
# attachments. Blank forms match too, so they are reported as errors.

# Layouts from data collection clients (researched with Claude Opus 5.5)
#
# Collect, folder copied from the device
# Android/data/org.odk.collect.android/files/projects/<project_uuid>
# ├── forms
# │   ├── Water.xml
# │   └── Water-media
# ├── instances
# │   ├── Water_2026-03-23_11-07-36
# │   │   ├── 1300878537573.jpg
# │   │   └── Water_2026-03-23_11-07-36.xml
# │   └── Registration_2026-03-21_19-33-34
# │       └── Registration_2026-03-21_19-33-34.xml
# ├── layers
# ├── metadata
# └── settings
#
# Enketo, zip exported from the queue of records saved offline
# <form_title>_2026-03-23_12-00-00.zip
# ├── meta.json
# ├── <form_title>_2026-03-23_11-07-36
# │   ├── 1300878537573.jpg
# │   └── submission.xml
# └── <form_title>_2026-03-21_19-33-34
#     └── submission.xml


def django_file(path, field_name, content_type):
    # adapted from here:
    # http://groups.google.com/group/django-users/browse_thread/thread/
    # 834f988876ff3c45/
    f = open(path, 'rb')
    return InMemoryUploadedFile(
        file=f,
        field_name=field_name,
        name=f.name,
        content_type=content_type,
        size=os.path.getsize(path),
        charset=None,
    )


def iterate_through_instances(dirpath, callback):
    total_file_count = 0
    success_count = 0
    errors = []

    for directory, subdirs, subfiles in os.walk(dirpath):
        for filename in subfiles:
            filepath = os.path.join(directory, filename)
            if XFormInstanceFS.is_valid_instance(filepath):
                xfxs = XFormInstanceFS(filepath)
                try:
                    success_count += callback(xfxs)
                except Exception as e:
                    errors.append('%s => %s' % (xfxs.filename, str(e)))
                del xfxs
                total_file_count += 1

    return total_file_count, success_count, errors


def import_instances_from_zip(
    zipfile_path: Union[str, BinaryIO],
    request: HttpRequest,
    status: str = 'zip',
) -> tuple[int, int, list[str]]:

    try:
        temp_directory = tempfile.mkdtemp()
        zf = zipfile.ZipFile(zipfile_path)

        zf.extractall(temp_directory)
    except zipfile.BadZipfile as e:
        errors = ['%s' % e]
        return 0, 0, errors
    else:
        return import_instances_from_path(temp_directory, request, status)
    finally:
        shutil.rmtree(temp_directory)


def import_instances_from_path(
    path: str,
    request: HttpRequest,
    status: str = 'zip',
) -> tuple[int, int, list[str]]:

    def callback(xform_fs: XFormInstanceFS) -> int:
        """
        This callback is passed an instance of a XFormInstanceFS.
        See xform_fs.py for more info.
        """

        with django_file(
            xform_fs.path,
            field_name='xml_file',
            content_type='text/xml',
        ) as xml_file:
            attachments = [
                django_file(
                    dir_entry.path,
                    field_name=dir_entry.name,
                    content_type=mimetypes.guess_type(dir_entry.name)[0],
                )
                for dir_entry in xform_fs.attachments
            ]
            # TODO: if an instance has been submitted make sure all the files are in the
            #  database. There shouldn't be any instances with a submitted status in the
            #  import.

            instance = create_instance(
                xml_file=xml_file,
                media_files=(a for a in attachments),
                request=request,
                status=status,
                owner_username=request.user.username,
            )

            for a in attachments:
                a.close()

            if instance:
                return 1
            else:
                return 0

    total_count, success_count, errors = iterate_through_instances(path, callback)

    return total_count, success_count, errors
