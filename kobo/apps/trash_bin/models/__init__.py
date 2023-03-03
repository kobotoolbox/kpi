from django.conf import settings
from django.db import models

from django.utils.timezone import now


class TrashStatus(models.TextChoices):

    IN_PROGRESS = 'in_progress', 'IN_PROGRESS'
    PENDING = 'pending', 'PENDING'
    FAILED = 'failed', 'FAILED'


class BaseTrash(models.Model):

    class Meta:
        abstract = True

    status = models.CharField(
        max_length=11,
        choices=TrashStatus.choices,
        default=TrashStatus.PENDING,
        db_index=True
    )
    periodic_task = models.OneToOneField(
        'django_celery_beat.PeriodicTask', null=True, on_delete=models.RESTRICT
    )
    request_author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_created = models.DateTimeField(default=now)
    date_modified = models.DateTimeField(default=now)
    metadata = models.JSONField(default=dict)
