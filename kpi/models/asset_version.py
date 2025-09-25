# coding: utf-8
import datetime
import json

from django.db import models
from formpack.utils.expand_content import expand_content

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.hash import calculate_hash
from kpi.utils.kobo_to_xlsform import to_xlsform_structure

DEFAULT_DATETIME = datetime.datetime(2010, 1, 1)


class AssetVersion(AbstractTimeStampedModel):
    uid = KpiUidField(uid_prefix='v')
    asset = models.ForeignKey('Asset', related_name='asset_versions',
                              on_delete=models.CASCADE)
    name = models.CharField(null=True, max_length=255)

    # preserve old reversion_version_ids so we can map old submissions to the
    # correct AssetVersion
    _reversion_version = models.IntegerField(
        blank=True, db_column='_reversion_version_id', null=True, unique=True
    )
    version_content = models.JSONField()
    uid_aliases = models.JSONField(null=True)
    # Tee hee, `deployed_content` is never written to the database!
    # TODO: It should be changed to a property instead, no?
    deployed_content = models.JSONField(null=True)
    _deployment_data = models.JSONField(default=dict)
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

    def to_formpack_unexpanded_schema(self):
        return {
            'content': self._deployed_content(),
            'version': self.uid,
            'version_id_key': '__version__',
        }

    @property
    def content_hash(self):
        # used to determine changes in the content from version to version
        # not saved, only compared with other asset_versions
        _json_string = json.dumps(self.version_content, sort_keys=True)
        return calculate_hash(_json_string, 'sha1')

    @property
    def form_title(self):
        if self.name != '':
            return self.name
        else:
            _settings = self.version_content.get('settings', {})
            return _settings.get('id_string', 'Untitled')

    def __str__(self):
        return '{}@{} T{}{}'.format(
            self.asset.uid, self.uid,
            self.date_modified.strftime('%Y-%m-%d %H:%M'),
            ' (deployed)' if self.deployed else '')
