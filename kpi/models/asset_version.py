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
    _content_hash = models.CharField(null=True, max_length=60)

    class Meta:
        ordering = ['-date_modified']

    def __str__(self):
        return '{}@{} T{}{}'.format(
            self.asset.uid,
            self.uid,
            self.date_modified.strftime('%Y-%m-%d %H:%M'),
            ' (deployed)' if self.deployed else '',
        )

    def _deployed_content(self):
        if self.deployed_content is not None:
            return self.deployed_content
        legacy_names = self._reversion_version is not None
        if legacy_names:
            return to_xlsform_structure(
                self.version_content, deprecated_autoname=True
            )
        else:
            return to_xlsform_structure(
                self.version_content, move_autonames=True
            )

    def to_formpack_schema(self):
        return {
            'content': expand_content(self._deployed_content()),
            'version': self.uid,
            'version_id_key': '__version__',
        }

    @property
    def content_hash(self) -> str:
        """
        SHA1 hash of the version content, used to detect changes between versions.

        Stored in the `_content_hash` DB column and populated at save time for
        new records. For existing records without a stored hash, it is computed
        lazily from `version_content` on first access. This fallback will
        disappear once all records have been backfilled via the long-running
        migration 0020
        """

        if not self._content_hash:
            _json_string = json.dumps(self.version_content, sort_keys=True)
            self._content_hash = calculate_hash(_json_string, 'sha1')

        return self._content_hash

    @property
    def form_title(self):
        if self.name != '':
            return self.name
        else:
            _settings = self.version_content.get('settings', {})
            return _settings.get('id_string', 'Untitled')

    def save(self, *args, **kwargs):
        _ = self.content_hash
        if 'update_fields' in kwargs and '_content_hash' not in kwargs['update_fields']:
            kwargs['update_fields'].append('_content_hash')

        super().save(*args, **kwargs)
