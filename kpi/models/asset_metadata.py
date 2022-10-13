# coding: utf-8
from django.db.models import JSONField as JSONBField
from django.db import models
from django.conf import settings
from django.utils import timezone

from kpi.fields import KpiUidField


class AssetMetadata(models.Model):
    uid = KpiUidField(uid_prefix='am')
    asset = models.ForeignKey(
        'Asset', related_name='asset_metadata', on_delete=models.CASCADE
    )
    date_modified = models.DateTimeField()
    settings = JSONBField(default=dict)

    def save(self, *args, **kwargs):
        self.date_modified = timezone.now()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-date_modified']

    def __str__(self):
        return f'{self.asset} metadata'
