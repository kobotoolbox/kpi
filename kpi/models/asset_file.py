# coding: utf-8
import posixpath

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone
from private_storage.fields import PrivateFileField

from kpi.fields import KpiUidField


def upload_to(self, filename):
    """
    Please note that due to Python 2 limitations, you cannot serialize unbound
    method functions (e.g. a method declared and used in the same class body).
    Please move the function into the main module body to use migrations. For
    more information, see
    https://docs.djangoproject.com/en/1.8/topics/migrations/#serializing-values
    """
    return posixpath.join(
        self.asset.owner.username, 'asset_files', self.asset.uid,
        self.file_type, filename
    )


class AssetFile(models.Model):
    # More to come!
    MAP_LAYER = 'map_layer'
    TYPE_CHOICES = (
        (MAP_LAYER, MAP_LAYER),
    )
    uid = KpiUidField(uid_prefix='af')
    asset = models.ForeignKey('Asset', related_name='asset_files',
                              on_delete=models.CASCADE)
    # Keep track of the uploading user, who could be anyone with `change_asset`
    # rights, not just the asset owner
    user = models.ForeignKey('auth.User', related_name='asset_files',
                             on_delete=models.CASCADE)
    file_type = models.CharField(choices=TYPE_CHOICES, max_length=32)
    name = models.CharField(max_length=255)
    date_created = models.DateTimeField(default=timezone.now)
    # TODO: Handle deletion! The file won't be deleted automatically when the
    # object is removed from the database
    content = PrivateFileField(upload_to=upload_to, max_length=380)
    metadata = JSONBField(default=dict)
