import os
import threading
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.core.exceptions import SuspiciousOperation
from django.test import TestCase, TransactionTestCase, override_settings
from freezegun import freeze_time

from ..models import LongRunningMigration, LongRunningMigrationStatus
from ..tasks import _heartbeat, async_execute, execute_long_running_migrations

FIXTURES_DIR = os.path.join(
    'kobo', 'apps', 'long_running_migrations', 'tests', 'fixtures'
)
LOCMEM_CACHE = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
}


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

    def test_retry_errors_keep_status_in_progress(self):
        retry_errors = [
            'another command is already in progress',
            'sending query failed',
            "can't change 'autocommit' now",
            'connection in transaction status ACTIVE',
            "can't change 'autocommit' now: connection in transaction status ACTIVE",
        ]
        migration = LongRunningMigration.objects.create(name='sample_task')
        for error_message in retry_errors:
            with self.subTest(error_message=error_message):
                migration.status = LongRunningMigrationStatus.CREATED
                migration.save(update_fields=['status'])
                mock_module = MagicMock()
                mock_module.run.side_effect = Exception(error_message)
                with patch.object(migration, '_load_module', return_value=mock_module):
                    migration.execute()
                migration.refresh_from_db()
                assert migration.status == LongRunningMigrationStatus.IN_PROGRESS

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

    def test_multiple_migrations_all_run(self):
        second_migration = LongRunningMigration.objects.create(name='sample_task_2')
        execute_long_running_migrations()
        self.migration.refresh_from_db()
        second_migration.refresh_from_db()
        assert self.migration.status == LongRunningMigrationStatus.COMPLETED
        assert second_migration.status == LongRunningMigrationStatus.COMPLETED


@override_settings(CACHES=LOCMEM_CACHE)
@patch.object(LongRunningMigration, 'LONG_RUNNING_MIGRATIONS_DIR', FIXTURES_DIR)
class LongRunningMigrationLockTestCase(TestCase):

    def setUp(self):
        cache.clear()

    def test_lock_prevents_duplicate_execution(self):
        migration = LongRunningMigration.objects.create(name='sample_task')
        lock_key = f'execute_long_running_migrations:{migration.name}'
        # Simulate the migration already running on another worker.
        cache.add(lock_key, 'true', timeout=300)
        with patch.object(LongRunningMigration, 'execute') as mocked_execute:
            async_execute(migration.pk)
        mocked_execute.assert_not_called()

    def test_lock_released_after_execution(self):
        migration = LongRunningMigration.objects.create(name='sample_task')
        lock_key = f'execute_long_running_migrations:{migration.name}'
        async_execute(migration.pk)
        assert cache.get(lock_key) is None

    def test_distinct_migrations_use_distinct_locks(self):
        first = LongRunningMigration.objects.create(name='sample_task')
        second = LongRunningMigration.objects.create(name='sample_task_2')
        # Hold the lock of the first migration only.
        cache.add(
            f'execute_long_running_migrations:{first.name}', 'true', timeout=300
        )
        async_execute(first.pk)
        async_execute(second.pk)
        first.refresh_from_db()
        second.refresh_from_db()
        # First is blocked by its lock, second runs on its own lock.
        assert first.status == LongRunningMigrationStatus.CREATED
        assert second.status == LongRunningMigrationStatus.COMPLETED


@override_settings(CACHES=LOCMEM_CACHE)
@patch.object(LongRunningMigration, 'LONG_RUNNING_MIGRATIONS_DIR', FIXTURES_DIR)
class LongRunningMigrationHeartbeatTestCase(TransactionTestCase):

    def setUp(self):
        cache.clear()

    def test_heartbeat_refreshes_lock_and_timestamp(self):
        migration = LongRunningMigration.objects.create(name='sample_task')
        lock_key = f'execute_long_running_migrations:{migration.name}'
        original_date_modified = migration.date_modified

        # Make wait() return False once so the body runs a single time, then
        # True so the loop exits. The thread stops on its own, so we don't need
        # to sleep. We use a real thread so the DB write happens on its own
        # connection, like in production.
        stop_event = MagicMock()
        stop_event.wait.side_effect = [False, True]
        heartbeat = threading.Thread(
            target=_heartbeat, args=(stop_event, lock_key, migration.pk)
        )
        heartbeat.start()
        heartbeat.join(timeout=5)

        assert not heartbeat.is_alive()
        migration.refresh_from_db()
        # `date_modified` moved forward and the lock is still held.
        assert migration.date_modified > original_date_modified
        assert cache.get(lock_key) == 'true'
