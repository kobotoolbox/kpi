# coding: utf-8
import datetime
import json

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone
from formpack.utils.expand_content import expand_content
from reversion.models import Version

from kpi.fields import KpiUidField
from kpi.utils.hash import calculate_hash
from kpi.utils.kobo_to_xlsform import to_xlsform_structure

DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(models.Model):
    uid = KpiUidField(uid_prefix='v')
    asset = models.ForeignKey('Asset', related_name='asset_versions',
                              on_delete=models.CASCADE)
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
    _deployment_data = JSONBField(default=dict)
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

    @property
    def content_hash(self):
        # used to determine changes in the content from version to version
        # not saved, only compared with other asset_versions
        _json_string = json.dumps(self.version_content, sort_keys=True)
        return calculate_hash(_json_string, 'sha1')

    def __str__(self):
        return '{}@{} T{}{}'.format(
            self.asset.uid, self.uid,
            self.date_modified.strftime('%Y-%m-%d %H:%M'),
            ' (deployed)' if self.deployed else '')
