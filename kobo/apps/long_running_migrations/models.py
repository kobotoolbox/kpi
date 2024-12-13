import importlib
import os

from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging


class LongRunningMigrationStatus(models.TextChoices):
    CREATED = 'created'
    IN_PROGRESS = 'in_progress'
    FAILED = 'failed'
    COMPLETED = 'completed'


class LongRunningMigration(AbstractTimeStampedModel):

    APP_DIR = os.path.basename(os.path.dirname(__file__))

    task_name = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        default=LongRunningMigrationStatus.CREATED,
        choices=LongRunningMigrationStatus.choices,
        max_length=20,
    )
    attempts = models.PositiveSmallIntegerField(default=0)

    def execute(self):
        if self.status == LongRunningMigrationStatus.COMPLETED:
            return

        module = importlib.import_module(
            os.path.join(self.APP_DIR, 'tasks', self.task_name)
        )
        self.status = LongRunningMigrationStatus.IN_PROGRESS
        self.attempts += self.attempts
        self.save(update_fields=['status', 'attempts'])
        try:
            module.task()
        except Exception as e:
            logging.error(f'LongRunningMigration.execute(): {str(e)}')
            self.status = LongRunningMigrationStatus.FAILED
            self.save(update_fields=['status'])
            return
        self.status = LongRunningMigrationStatus.COMPLETED
        self.save(update_fields=['status'])

    def save(self, **kwargs):
        if self._state.adding:
            file_path = os.path.join(self.APP_DIR, 'tasks', f'{self.task_name}.py')
            if not os.path.exists(file_path):
                raise ValueError('Task does not exist in tasks directory')
        super().save(**kwargs)
