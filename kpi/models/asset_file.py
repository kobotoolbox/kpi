# coding: utf-8
import posixpath
from mimetypes import guess_type

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone
from private_storage.fields import PrivateFileField
from rest_framework.reverse import reverse

from kpi.fields import KpiUidField
from kpi.interfaces.open_rosa import OpenRosaManifestInterface
from kpi.utils.hash import get_hash


def upload_to(self, filename):
    """
    Please note that due to Python 2 limitations, you cannot serialize unbound
    method functions (e.g. a method declared and used in the same class body).
    Please move the function into the main module body to use migrations. For
    more information, see
    https://docs.djangoproject.com/en/1.8/topics/migrations/#serializing-values
    """
    return AssetFile.get_path(self.asset, self.file_type, filename)


class AssetFile(OpenRosaManifestInterface, models.Model):

    # More to come!
    MAP_LAYER = 'map_layer'
    FORM_MEDIA = 'form_media'
    PAIRED_DATA = 'paired_data'

    TYPE_CHOICES = (
        (MAP_LAYER, MAP_LAYER),
        (FORM_MEDIA, FORM_MEDIA),
        (PAIRED_DATA, PAIRED_DATA),
    )

    ALLOWED_MIME_TYPES = {
        FORM_MEDIA: ('image', 'audio', 'video', 'text/csv', 'application/xml'),
        PAIRED_DATA: ('application/xml',),
    }

    ALLOWED_EXTENSIONS = {
        MAP_LAYER: ('csv', 'kml', 'kmz', 'wkt', 'geojson', 'json'),
        PAIRED_DATA: ('xml',),
    }

    uid = KpiUidField(uid_prefix='af')
    asset = models.ForeignKey('Asset', related_name='asset_files',
                              on_delete=models.CASCADE)
    # Keep track of the uploading user, who could be anyone with `change_asset`
    # rights, not just the asset owner
    user = models.ForeignKey('auth.User', related_name='asset_files',
                             on_delete=models.CASCADE)
    file_type = models.CharField(choices=TYPE_CHOICES, max_length=32)
    description = models.CharField(max_length=255)
    date_created = models.DateTimeField(default=timezone.now)
    content = PrivateFileField(upload_to=upload_to, max_length=380, null=True)
    metadata = JSONBField(default=dict)
    date_deleted = models.DateTimeField(null=True, default=None)
    date_modified = models.DateTimeField(default=timezone.now)

    def delete(self, using=None, keep_parents=False, force=False):

        # Delete object and files on storage if `force` is True or file type
        # is anything else than 'form_media'
        if force or self.file_type != self.FORM_MEDIA:
            if not self.is_remote_url:
                self.content.delete(save=False)
            return super().delete(using=using, keep_parents=keep_parents)

        # Otherwise, just flag the file as deleted.
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])

    @property
    def filename(self):
        """
        Implements `OpenRosaManifestInterface.filename()`
        """
        if hasattr(self, '__filename'):
            return self.__filename

        self.set_filename()
        self.__filename = self.metadata['filename']
        return self.__filename

    def get_download_url(self, request):
        """
        Implements `OpenRosaManifestInterface.get_download_url()`
        """
        return reverse('asset-file-content',
                       args=(self.asset.uid, self.uid),
                       request=request)

    @staticmethod
    def get_path(asset, file_type, filename):
        return posixpath.join(
            asset.owner.username,
            'asset_files',
            asset.uid,
            file_type,
            filename
        )

    @property
    def hash(self):
        """
        Implements `OpenRosaManifestInterface.hash()`
        """
        if hasattr(self, '__hash'):
            return self.__hash

        self.set_hash()
        self.__hash = self.metadata['hash']
        return self.__hash

    @property
    def is_remote_url(self):
        try:
            self.metadata['redirect_url']
        except KeyError:
            return False

        return True

    @property
    def kc_metadata_data_value(self):
        return (
            self.metadata['redirect_url']
            if self.is_remote_url
            else self.filename
        )

    @property
    def kc_metadata_uniqid(self):
        return (
            self.metadata['filename']
            if not self.is_remote_url
            else self.metadata['redirect_url']
        )

    @property
    def mimetype(self):
        if hasattr(self, '__mimetype'):
            return self.__mimetype

        self.set_mimetype()
        self.__mimetype = self.metadata['mimetype']
        return self.__mimetype

    def save(self, force_insert=False, force_update=False, using=None,
             update_fields=None):
        if self.pk is None:
            self.set_filename()
            self.set_hash()
            self.set_mimetype()
        else:
            self.date_modified = timezone.now()

        return super().save(force_insert, force_update, using, update_fields)

    def set_filename(self):
        if not self.metadata.get('filename'):
            self.metadata['filename'] = self.content.name

    def set_hash(self):
        if not self.metadata.get('hash'):
            if self.is_remote_url:
                md5_hash = get_hash(self.metadata['redirect_url'])
            else:
                md5_hash = get_hash(self.content.file.read())

            self.metadata['hash'] = f'md5:{md5_hash}'

    def set_mimetype(self):
        mimetype, _ = guess_type(self.filename)
        self.metadata['mimetype'] = mimetype

