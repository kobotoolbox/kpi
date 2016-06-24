import json
import hashlib
import datetime

from django.db import models

from jsonbfield.fields import JSONField as JSONBField
from reversion.models import Version
from ..fields import KpiUidField
from ..utils.kobo_to_xlsform import to_xlsform_structure

DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(models.Model):
    uid = KpiUidField(uid_prefix='v')
    asset = models.ForeignKey('Asset', related_name='asset_versions')
    name = models.CharField(null=True, max_length=255)
    date_modified = models.DateTimeField(default=DEFAULT_DATETIME)

    # preserving _reversion_version in case we don't save all that we
    # need to in the first migration from reversion to AssetVersion
    _reversion_version = models.OneToOneField(Version,
                                              null=True,
                                              on_delete=models.SET_NULL,
                                              )
    version_content = JSONBField()
    deployed_content = JSONBField(null=True)
    _deployment_data = JSONBField(default=False)
    deployed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_modified']

    def _deployed_content(self):
        legacy_names = self._reversion_version is not None
        return to_xlsform_structure(self.version_content,
                                    autoname=True,
                                    deprecated_autoname=legacy_names)

    def _content_hash(self):
        # used to determine changes in the content from version to version
        _json_string = json.dumps(self.version_content, sort_keys=True)
        return hashlib.sha1(_json_string).hexdigest()
