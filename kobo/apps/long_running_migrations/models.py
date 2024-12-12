from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel


class LongRunningMigrationStatus(models.TextChoices):

    CREATED = 'created'
    IN_PROGRESS = 'in_progress'
    FAILED = 'failed'
    COMPLETED = 'completed'


class LongRunningMigration(AbstractTimeStampedModel):

    app = models.CharField(max_length=100)
    task_name = models.CharField(max_length=255)
    status = models.CharField(
        default=LongRunningMigrationStatus.CREATED,
        choices=LongRunningMigrationStatus.choices,
        max_length=20,
    )

    class Meta:
        indexes = [
            models.Index(fields=['app', 'task_name']),
        ]
