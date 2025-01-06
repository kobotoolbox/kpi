from datetime import timedelta
from unittest.mock import patch

from constance.test import override_config
from django.test import override_settings
from django.utils import timezone

from kobo.apps.audit_log.models import (
    AccessLog,
    ProjectHistoryLog,
)
from kobo.apps.audit_log.tasks import (
    batch_delete_audit_logs_by_id,
    enqueue_logs_for_deletion,
    spawn_logs_cleaning_tasks,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PROJECT_HISTORY_LOG_PROJECT_SUBTYPE
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase


@override_config(ACCESS_LOG_LIFESPAN=1)
class AuditLogTasksTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.three_days_ago = timezone.now() - timedelta(days=3)
        self.asset = Asset.objects.get(pk=1)

    def test_delete_logs(self):
        AccessLog.objects.create(
            user=self.user, date_created=self.three_days_ago
        )
        ProjectHistoryLog.objects.create(
            user=self.user,
            date_created=self.three_days_ago,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '0.0.0.0',
                'source': 'source',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'latest_version_uid': '0',
            },
            object_id=self.asset.id,
        )

        self.assertEqual(AccessLog.objects.count(), 1)
        enqueue_logs_for_deletion(AccessLog, 1)
        self.assertEqual(AccessLog.objects.count(), 0)
        # Ensure that the delete_logs function only deletes the objects for the given
        # log class
        self.assertEqual(ProjectHistoryLog.objects.count(), 1)
        enqueue_logs_for_deletion(ProjectHistoryLog, 1)
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_spawn_deletion_task_identifies_expired_logs(self):
        """
        Test the spawning task correctly identifies which logs to delete.

        Separated for easier debugging of the spawning vs deleting steps
        """
        old_log = AccessLog.objects.create(
            user=self.user,
            date_created=timezone.now() - timedelta(days=1, hours=1),
        )
        older_log = AccessLog.objects.create(
            user=self.user,
            date_created=timezone.now() - timedelta(days=2)
        )
        new_log = AccessLog.objects.create(user=self.user)

        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_logs_cleaning_tasks()

        # get the list of ids passed for any call to the actual deletion task
        id_lists = [kwargs['ids'] for _, _, kwargs in patched_spawned_task.mock_calls]
        # flatten the list
        all_deleted_ids = [log_id for id_list in id_lists for log_id in id_list]
        self.assertIn(old_log.id, all_deleted_ids)
        self.assertIn(older_log.id, all_deleted_ids)
        self.assertNotIn(new_log.id, all_deleted_ids)

    @override_settings(LOG_DELETION_BATCH_SIZE=2)
    def test_spawn_task_batches_ids(self):
        old_log_1 = AccessLog.objects.create(
            user=self.user, date_created=self.three_days_ago
        )
        old_log_2 = AccessLog.objects.create(
            user=self.user, date_created=self.three_days_ago
        )
        old_log_3 = AccessLog.objects.create(
            user=self.user, date_created=self.three_days_ago
        )

        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_logs_cleaning_tasks()

        # Should be 2 batches
        self.assertEqual(patched_spawned_task.call_count, 2)
        # make sure all batches were <= LOG_DELETION_BATCH_SIZE
        all_deleted_ids = []
        for task_call in patched_spawned_task.mock_calls:
            _, _, kwargs = task_call
            id_list = kwargs['ids']
            self.assertLessEqual(len(id_list), 2)
            all_deleted_ids.extend(id_list)

        # make sure we queued everything for deletion
        self.assertIn(old_log_1.id, all_deleted_ids)
        self.assertIn(old_log_2.id, all_deleted_ids)
        self.assertIn(old_log_3.id, all_deleted_ids)

    def test_batch_delete_audit_logs_by_id(self):
        log_1 = AccessLog.objects.create(user=self.user)
        log_2 = AccessLog.objects.create(user=self.user)
        log_3 = AccessLog.objects.create(user=self.user)
        self.assertEqual(AccessLog.objects.count(), 3)

        batch_delete_audit_logs_by_id(ids=[log_1.id, log_2.id])
        # only log_3 should remain
        self.assertEqual(AccessLog.objects.count(), 1)
        self.assertEqual(AccessLog.objects.first().id, log_3.id)
