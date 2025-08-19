import os
from importlib.util import module_from_spec, spec_from_file_location

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
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
    error = models.TextField(null=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Long-running migration'

    def __str__(self):
        return self.name

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

        if not (module := self._load_module()):
            return

        self.status = LongRunningMigrationStatus.IN_PROGRESS
        self.attempts += 1
        self.save(update_fields=['status', 'attempts', 'date_modified'])

        try:
            module.run()
        except (SoftTimeLimitExceeded, TimeLimitExceeded):
            # Let's continue in the next round — this task took too long to
            # complete in a single run.
            return
        except Exception as e:
            # Log the error and update the status to 'failed'
            logging.error(f'LongRunningMigration.execute(): {str(e)}')
            self.status = LongRunningMigrationStatus.FAILED
            self.error = str(e)
            self.save(update_fields=['status', 'date_modified', 'error'])
            return

        self.status = LongRunningMigrationStatus.COMPLETED
        self.error = ''
        self.save(update_fields=['status', 'date_modified', 'error'])

    def save(self, **kwargs):

        self.clean()

        if self._state.adding:
            file_path = os.path.join(
                settings.BASE_DIR, self.LONG_RUNNING_MIGRATIONS_DIR, f'{self.name}.py'
            )
            if not os.path.exists(file_path):
                raise ValueError('Task does not exist in tasks directory')
        super().save(**kwargs)

    def _load_module(self):
        """
        This function allows you to load a Python module from a file path even if
        the module's name does not follow Python's standard naming conventions
        (e.g., starting with numbers or containing special characters). Normally,
        Python identifiers must adhere to specific rules, but this method bypasses
        those restrictions by dynamically creating a module from its file.
        """
        module_path = f'{self.LONG_RUNNING_MIGRATIONS_DIR}/{self.name}.py'
        if not os.path.exists(f'{settings.BASE_DIR}/{module_path}'):
            logging.error(
                f'LongRunningMigration._load_module():'
                f'File not found `{module_path}`'
            )
            return

        spec = spec_from_file_location(self.name, module_path)
        try:
            module = module_from_spec(spec)
        except (ModuleNotFoundError, AttributeError):
            logging.error(
                f'LongRunningMigration._load_module():'
                f'Failed to import migration module `{self.name}`'
            )
            return

        spec.loader.exec_module(module)
        return module
