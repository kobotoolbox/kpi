import importlib
import os

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging


class LongRunningMigrationStatus(models.TextChoices):
    CREATED = 'created'
    IN_PROGRESS = 'in_progress'
    FAILED = 'failed'
    COMPLETED = 'completed'


class LongRunningMigration(AbstractTimeStampedModel):

    LONG_RUNNING_MIGRATIONS_DIR = os.path.join(
        'kobo',
        'apps',
        'long_running_migrations',
        'jobs'
    )

    name = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        default=LongRunningMigrationStatus.CREATED,
        choices=LongRunningMigrationStatus.choices,
        max_length=20,
    )
    attempts = models.PositiveSmallIntegerField(default=0)

    def clean(self):
        super().clean()
        if '..' in self.name or '/' in self.name or '\\' in self.name:
            raise SuspiciousOperation(
                f"Invalid migration name '{self.name}'. "
                f"Migration names cannot contain directory traversal characters "
                f"such as '..', '/', or '\\'."
            )

    def execute(self):
        # Skip execution if the migration is already completed
        if self.status == LongRunningMigrationStatus.COMPLETED:
            return

        base_import = self.LONG_RUNNING_MIGRATIONS_DIR.replace('/', '.')
        try:
            module = importlib.import_module('.'.join([base_import, self.name]))
        except ModuleNotFoundError as e:
            logging.error(
                f'LongRunningMigration.execute(), '
                f'failed to import task module: {str(e)}'
            )
            return

        self.status = LongRunningMigrationStatus.IN_PROGRESS
        self.attempts += self.attempts
        self.save(update_fields=['status', 'attempts'])

        try:
            module.run()
        except Exception as e:
            # Log the error and update the status to 'failed'
            logging.error(f'LongRunningMigration.execute(): {str(e)}')
            self.status = LongRunningMigrationStatus.FAILED
            self.save(update_fields=['status'])
            return

        self.status = LongRunningMigrationStatus.COMPLETED
        self.save(update_fields=['status'])

    def save(self, **kwargs):

        self.clean()

        if self._state.adding:
            file_path = os.path.join(
                settings.BASE_DIR, self.LONG_RUNNING_MIGRATIONS_DIR, f'{self.name}.py'
            )
            if not os.path.exists(file_path):
                raise ValueError('Task does not exist in tasks directory')
        super().save(**kwargs)
