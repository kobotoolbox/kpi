# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField


class AssetExportSettings(models.Model):
    uid = KpiUidField(uid_prefix='es')
    asset = models.ForeignKey('Asset', related_name='asset_export_settings',
                              on_delete=models.CASCADE)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=255)
    export_settings = JSONBField(null=True)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-date_modified']

    def __str__(self):
        return f'{self.name} {self.uid}'

