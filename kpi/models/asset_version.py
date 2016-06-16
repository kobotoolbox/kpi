from django.db import models
from jsonfield import JSONField

import datetime
DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(models.Model):
    asset = models.ForeignKey('Asset', related_name='asset_versions')
    name = models.CharField(null=True, max_length=255)
    date_modified = models.DateTimeField(default=DEFAULT_DATETIME)

    _reversion_version_id = models.PositiveIntegerField(null=True)
    version_content = JSONField()
    deployed_content = JSONField()
    is_deployed = models.BooleanField(default=False)
