from __future__ import annotations

from django.conf import settings
from django.db import models

from kpi.fields import KpiUidField
from . import BaseTrash


class AccountTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='at')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name='trash', on_delete=models.CASCADE
    )

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self) -> str:
        return f'{self.user.username} - {self.periodic_task.start_time}'
