import os
from unittest.mock import patch

from django.core.exceptions import SuspiciousOperation
from django.test import TestCase, override_settings
from freezegun import freeze_time

from ..models import LongRunningMigration, LongRunningMigrationStatus
from ..tasks import execute_long_running_migrations


@override_settings(
    CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
    }
)
@patch.object(LongRunningMigration, 'LONG_RUNNING_MIGRATIONS_DIR', os.path.join(
    'kobo',
    'apps',
    'long_running_migrations',
    'tests',
    'fixtures'
))
class LongRunningMigrationTestCase(TestCase):
    def test_sample_task(self):
        migration = LongRunningMigration.objects.create(name='sample_task')
        migration.execute()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.COMPLETED)

    def test_invalid_task_name(self):
        with self.assertRaises(ValueError):
            LongRunningMigration.objects.create(name='foo')

    def test_traversal_characters(self):
        with self.assertRaises(SuspiciousOperation):
            LongRunningMigration.objects.create(name='../fixtures/sample_task')

    def test_sample_failure(self):
        migration = LongRunningMigration.objects.create(name='sample_failure')
        migration.execute()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.FAILED)

    def test_not_updated_worker(self):
        # simulate not updated worker with a wrong name
        migrations = LongRunningMigration.objects.bulk_create(
            [LongRunningMigration(name='foo')]
        )
        migration = migrations[0]
        migration.execute()
        migration.refresh_from_db()
        self.assertEqual(migration.status, LongRunningMigrationStatus.CREATED)


@override_settings(
    CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
    }
)
class LongRunningMigrationPeriodicTaskTestCase(TestCase):

    def setUp(self):
        self.patcher = patch.object(
            LongRunningMigration,
            'LONG_RUNNING_MIGRATIONS_DIR',
            os.path.join('kobo', 'apps', 'long_running_migrations', 'tests', 'fixtures')
        )
        self.patcher.start()
        self.migration = LongRunningMigration.objects.create(name='sample_task')

        # Remove real existing long-running migrations
        LongRunningMigration.objects.exclude(pk=self.migration.pk).delete()
        assert LongRunningMigration.objects.count() == 1

    def tearDown(self):
        self.patcher.stop()

    def test_migration_as_completed(self):
        execute_long_running_migrations()
        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)

    def test_failed_migration_is_ignored(self):
        # Ignore failed task
        self.migration.status = LongRunningMigrationStatus.FAILED
        self.migration.save(update_fields=['status'])
        execute_long_running_migrations()
        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.FAILED)

    def test_ignore_recent_started_migration(self):
        # Ignore recent started tasks
        self.migration.status = LongRunningMigrationStatus.IN_PROGRESS
        self.migration.save()
        execute_long_running_migrations()
        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.IN_PROGRESS)

    def test_resume_stuck_migration(self):
        # Run an old in-progress task
        with freeze_time('2024-12-10'):
            self.migration.status = LongRunningMigrationStatus.IN_PROGRESS
            self.migration.save()
        execute_long_running_migrations()
        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)
