from django.test import TestCase
from freezegun import freeze_time

from .maintenance_tasks import execute_long_running_migrations
from .models import LongRunningMigration, LongRunningMigrationStatus


class LongRunningMigrationTestCase(TestCase):
    def test_sample_task(self):
        migration = LongRunningMigration.objects.create(task_name='sample_task')
        migration.execute()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.COMPLETED)

    def test_invalid_task_name(self):
        with self.assertRaises(ValueError):
            LongRunningMigration.objects.create(task_name='foo')

    def test_sample_failure(self):
        migration = LongRunningMigration.objects.create(task_name='sample_failure')
        migration.execute()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.FAILED)

    def test_maintenance(self):
        # # New task
        migration = LongRunningMigration.objects.create(task_name='sample_task')
        execute_long_running_migrations()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.COMPLETED)

        # Ignore failed task
        migration.status = LongRunningMigrationStatus.FAILED
        migration.save()
        execute_long_running_migrations()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.FAILED)

        # Ignore recently in progress task
        migration.status = LongRunningMigrationStatus.IN_PROGRESS
        migration.save()
        execute_long_running_migrations()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.IN_PROGRESS)

        # Run old in progress task
        with freeze_time('2024-12-10'):
            migration.status = LongRunningMigrationStatus.IN_PROGRESS
            migration.save()
        execute_long_running_migrations()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.COMPLETED)
