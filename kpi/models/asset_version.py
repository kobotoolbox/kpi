import json
import hashlib
import datetime
from django.utils import timezone

from django.db import models

from jsonbfield.fields import JSONField as JSONBField
from reversion.models import Version
from ..fields import KpiUidField
from ..utils.kobo_to_xlsform import to_xlsform_structure

from formpack.utils.expand_content import expand_content

DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(models.Model):
    uid = KpiUidField(uid_prefix='v')
    asset = models.ForeignKey('Asset', related_name='asset_versions')
    name = models.CharField(null=True, max_length=255)
    date_modified = models.DateTimeField(default=timezone.now)

    # preserving _reversion_version in case we don't save all that we
    # need to in the first migration from reversion to AssetVersion
    _reversion_version = models.OneToOneField(Version,
                                              null=True,
                                              on_delete=models.SET_NULL,
                                              )
    version_content = JSONBField()
    uid_aliases = JSONBField(null=True)
    deployed_content = JSONBField(null=True)
    _deployment_data = JSONBField(default=False)
    deployed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_modified']

    def _deployed_content(self):
        if self.deployed_content is not None:
            return self.deployed_content
        legacy_names = self._reversion_version is not None
        if legacy_names:
            return to_xlsform_structure(self.version_content,
                                        deprecated_autoname=True)
        else:
            return to_xlsform_structure(self.version_content,
                                        move_autonames=True)

    def to_formpack_schema(self):
        return {
            'content': expand_content(self._deployed_content()),
            'version': self.uid,
            'version_id_key': '__version__',
        }

    def _content_hash(self):
        # used to determine changes in the content from version to version
        # not saved, only compared with other asset_versions (in tests and
        # migration scripts, initially)
        _json_string = json.dumps({'version_content': self.version_content,
                                   'deployed_content': self.deployed_content,
                                   'deployed': self.deployed,
                                   }, sort_keys=True)
        return hashlib.sha1(_json_string).hexdigest()

    def __unicode__(self):
        return '{}@{} T{}{}'.format(self.asset.uid, self.uid,
                    self.date_modified.strftime('%Y-%m-%d %H:%m'),
                    ' (deployed)' if self.deployed else '')
