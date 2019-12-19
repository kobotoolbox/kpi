# coding: utf-8
import posixpath
from mimetypes import guess_type

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone
from private_storage.fields import PrivateFileField

from kpi.fields import KpiUidField
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


class AssetFile(models.Model):

    # More to come!
    MAP_LAYER = 'map_layer'
    FORM_MEDIA = 'form_media'

    TYPE_CHOICES = (
        (MAP_LAYER, MAP_LAYER),
        (FORM_MEDIA, FORM_MEDIA),
    )

    ALLOWED_CONTENT_TYPES = {
        FORM_MEDIA: ('image', 'video', 'text/csv', 'application/xml'),
    }

    ALLOWED_EXTENSIONS = {
        MAP_LAYER: ('csv', 'kml', 'kmz', 'wkt', 'geojson', 'json'),
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
    content = PrivateFileField(upload_to=upload_to, max_length=380)
    metadata = JSONBField(default=dict)

    @staticmethod
    def get_path(asset, file_type, filename):
        return posixpath.join(
            asset.owner.username,
            'asset_files',
            asset.uid,
            file_type, filename
        )

    def save(self, force_insert=False, force_update=False, using=None,
             update_fields=None):
        self.set_filename()
        self.set_hash()
        self.set_mimetype()
        return super().save(force_insert, force_update, using, update_fields)

    def set_filename(self):
        if not self.metadata.get('filename'):
            self.metadata['filename'] = self.content.name

    def set_hash(self):
        md5_hash = get_hash(self.content.file.read())
        self.metadata['hash'] = f'md5:{md5_hash}'

    def set_mimetype(self):
        mimetype, _ = guess_type(self.metadata['filename'])
        self.metadata['mimetype'] = mimetype

