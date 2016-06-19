import datetime

from django.db import models
from jsonfield import JSONField
from reversion.models import Version

DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(models.Model):
    asset = models.ForeignKey('Asset', related_name='asset_versions')
    name = models.CharField(null=True, max_length=255)
    date_modified = models.DateTimeField(default=DEFAULT_DATETIME)

    _reversion_version = models.OneToOneField(Version,
                                              null=True,
                                              on_delete=models.SET_NULL,
                                              )
    version_content = JSONField()
    deployed_content = JSONField()
    _deployment_data = JSONField(default=False)
    is_deployed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_modified']
