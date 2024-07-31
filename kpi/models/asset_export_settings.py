# coding: utf-8
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel


class AssetExportSettings(AbstractTimeStampedModel):
    """
    For a description of `export_settings`, see docstring of
    kpi.views.v2.asset_export_settings.AssetExportSettingsViewSet
    """
    uid = KpiUidField(uid_prefix='es')
    asset = models.ForeignKey('Asset', related_name='asset_export_settings',
                              on_delete=models.CASCADE)
    name = models.CharField(max_length=255, blank=True, default='')
    export_settings = models.JSONField(default=dict)

    class Meta:
        ordering = ['-date_modified']
        unique_together = ('asset', 'name')

    def __str__(self):
        return f'{self.name} ({self.uid})'
