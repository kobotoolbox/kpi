from __future__ import annotations

from django.db import models

from kpi.fields import KpiUidField
from . import BaseTrash


class ProjectTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='pt')
    asset = models.OneToOneField(
        'kpi.Asset', related_name='trash', on_delete=models.CASCADE
    )

    class Meta(BaseTrash.Meta):
        verbose_name = 'project'
        verbose_name_plural = 'projects'

    def __str__(self) -> str:
        return f'{self.asset} - {self.periodic_task.start_time}'
