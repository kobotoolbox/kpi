# coding: utf-8
import datetime

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField


class AssetExportSettings(models.Model):
    uid = KpiUidField(uid_prefix='es')
    asset = models.ForeignKey('Asset', related_name='asset_export_settings',
                              on_delete=models.CASCADE)
    date_modified = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=255)
    export_settings = JSONBField(null=True)

    class Meta:
        ordering = ['-date_modified']

    def __str__(self):
        return '{} {}'.format(
            self.name,
            self.uid,
        )
