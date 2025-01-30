import mimetypes
import os
from contextlib import closing
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.temp import NamedTemporaryFile
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.validators import URLValidator
from django.db import models
from requests.exceptions import RequestException

from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.fields.file import ExtendedFileField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.hash import calculate_hash


CHUNK_SIZE = 1024

urlvalidate = URLValidator()


def is_valid_url(uri):
    try:
        urlvalidate(uri)
    except ValidationError:
        return False

    return True


def upload_to(instance, filename):

    xform_unique_id = (
        instance.xform.uuid
        or instance.xform.id_string
        or '__pk-{}'.format(instance.xform.pk)
    )

    if instance.data_type == 'media':
        return os.path.join(
            instance.xform.user.username,
            'form-media',
            xform_unique_id,
            filename
        )

    return os.path.join(
        instance.xform.user.username,
        'docs',
        xform_unique_id,
        filename
    )


def unique_type_for_form(xform, data_type, data_value=None, data_file=None):
    result = type_for_form(xform, data_type)
    if not len(result):
        result = MetaData(data_type=data_type, xform=xform)
        result.save()
    else:
        result = result[0]
    if data_value:
        result.data_value = data_value
        result.save()
    if data_file:
        if result.data_value is None or result.data_value == '':
            result.data_value = data_file.name
        result.data_file = data_file
        result.data_file_type = data_file.content_type
        result.save()
    return result


def type_for_form(xform, data_type):
    return MetaData.objects.filter(xform=xform, data_type=data_type)


def create_media(media):
    """Download media link"""
    if is_valid_url(media.data_value):
        filename = media.filename
        data_file = NamedTemporaryFile()
        content_type = mimetypes.guess_type(filename)
        with closing(requests.get(media.data_value, stream=True)) as r:
            for chunk in r.iter_content(chunk_size=CHUNK_SIZE):
                if chunk:
                    data_file.write(chunk)
        data_file.seek(os.SEEK_SET, os.SEEK_END)
        size = os.path.getsize(data_file.name)
        data_file.seek(os.SEEK_SET)
        media.data_value = filename
        media.data_file = InMemoryUploadedFile(
            data_file, 'data_file', filename, content_type,
            size, charset=None)

        return media

    return None


def media_resources(media_list, download=False):
    """
    List of MetaData objects of type media

    @param media_list - list of MetaData objects of type `media`
    @param download - boolean, when True downloads media files when
                      media.data_value is a valid url

    return a list of MetaData objects
    """
    data = []
    for media in media_list:
        if media.data_file.name == '' and download:
            media = create_media(media)
            if media:
                data.append(media)
        else:
            data.append(media)

    return data


class MetaData(AbstractTimeStampedModel):

    MEDIA_FILES_TYPE = [
        'media',
        'paired_data',
    ]

    xform = models.ForeignKey(XForm, on_delete=models.CASCADE)
    data_type = models.CharField(max_length=255)
    data_value = models.CharField(max_length=255)
    data_file = ExtendedFileField(
        storage=default_storage,
        upload_to=upload_to,
        blank=True,
        null=True,
        max_length=380,
    )
    data_file_type = models.CharField(max_length=255, blank=True, null=True)
    file_hash = models.CharField(max_length=50, blank=True, null=True)
    from_kpi = models.BooleanField(default=False)
    data_filename = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        app_label = 'main'
        unique_together = ('xform', 'data_type', 'data_value')

    @property
    def is_paired_data(self) -> bool:
        return self.data_type == 'paired_data'

    def save(self, *args, **kwargs):
        self._set_hash()

        super().save(*args, **kwargs)

    @property
    def md5_hash(self) -> str:
        return self._set_hash()

    @property
    def filename(self) -> str:

        # `self.__filename` has already been cached, return it.
        if getattr(self, '__filename', None):
            return self.__filename

        # If it is a remote URL, get the filename from it and return it
        if (
            self.data_type in self.MEDIA_FILES_TYPE
            and is_valid_url(self.data_value)
        ):
            if self.data_filename:
                self.__filename = self.data_filename
            else:
                parsed_url = urlparse(self.data_value)
                self.__filename = os.path.basename(parsed_url.path)

            return self.__filename

        # Return `self.data_value` as fallback
        return self.data_value

    def _set_hash(self) -> str:
        """
        Recalculates `file_hash` if it does not exist already. KPI, for
        example, sends a precalculated hash of the file content (or of the URL
        string, if the file is a reference to a remote URL) when synchronizing
        form media.
        """

        if self.data_file:

            if self.file_hash:
                return self.file_hash

            try:
                self.file_hash = calculate_hash(self.data_file, prefix=True)
            except (IOError, FileNotFoundError) as e:
                return ''
            else:
                return self.file_hash

        if not self.from_kpi:
            return ''

        # Object should be a URL at this point `POST`ed by KPI.

        # Verify first whether it is dynamic external XML.
        if self.is_paired_data:
            return self.file_hash

        # We have to set the hash
        try:
            self.file_hash = calculate_hash(self.data_value, prefix=True)
        except RequestException as e:
            return ''
        else:
            return self.file_hash

    @staticmethod
    def public_link(xform, data_value=None):
        data_type = 'public_link'
        if data_value is False:
            data_value = 'False'
        metadata = unique_type_for_form(xform, data_type, data_value)
        # make text field a boolean
        if metadata.data_value == 'True':
            return True
        else:
            return False

    @staticmethod
    def form_license(xform, data_value=None):
        data_type = 'form_license'
        return unique_type_for_form(xform, data_type, data_value)

    @staticmethod
    def data_license(xform, data_value=None):
        data_type = 'data_license'
        return unique_type_for_form(xform, data_type, data_value)

    @staticmethod
    def source(xform, data_value=None, data_file=None):
        data_type = 'source'
        return unique_type_for_form(xform, data_type, data_value, data_file)

    @staticmethod
    def supporting_docs(xform, data_file=None):
        data_type = 'supporting_doc'
        if data_file:
            doc = MetaData(data_type=data_type, xform=xform,
                           data_value=data_file.name,
                           data_file=data_file,
                           data_file_type=data_file.content_type)
            doc.save()
        return type_for_form(xform, data_type)

    @staticmethod
    def media_upload(xform, data_file=None, download=False):
        data_type = 'media'
        if data_file:
            allowed_types = settings.SUPPORTED_MEDIA_UPLOAD_TYPES
            content_type = data_file.content_type \
                if data_file.content_type in allowed_types else \
                mimetypes.guess_type(data_file.name)[0]
            if content_type in allowed_types:
                media = MetaData(data_type=data_type, xform=xform,
                                 data_value=data_file.name,
                                 data_file=data_file,
                                 data_file_type=content_type)
                media.save()
        return media_resources(type_for_form(xform, data_type), download)

    @staticmethod
    def media_add_uri(xform, uri):
        """Add a uri as a media resource"""
        data_type = 'media'

        if is_valid_url(uri):
            media = MetaData(data_type=data_type, xform=xform,
                             data_value=uri)
            media.save()
