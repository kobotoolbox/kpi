import os
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
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
