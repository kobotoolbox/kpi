from __future__ import annotations

from django.db import models
from django.utils.timezone import now

from kpi.fields import KpiUidField


class ProjectTrashStatus(models.TextChoices):

    IN_PROGRESS = 'in_progress', 'IN_PROGRESS'
    PENDING = 'pending', 'PENDING'
    FAILED = 'failed', 'FAILED'


class ProjectTrash(models.Model):

    uid = KpiUidField(uid_prefix='t')
    status = models.CharField(
        max_length=11,
        choices=ProjectTrashStatus.choices,
        default=ProjectTrashStatus.PENDING,
        db_index=True
    )
    asset = models.OneToOneField(
        'kpi.Asset', related_name='trash', null=True, on_delete=models.CASCADE
    )
    periodic_task = models.OneToOneField(
        'django_celery_beat.PeriodicTask', null=True, on_delete=models.RESTRICT
    )
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    date_created = models.DateTimeField(default=now)
    date_modified = models.DateTimeField(default=now)
    metadata = models.JSONField(default=dict)

    class Meta:
        verbose_name = 'project'
        verbose_name_plural = 'projects'

    def __str__(self) -> str:
        return f'{self.asset} - {self.periodic_task.start_time}'
