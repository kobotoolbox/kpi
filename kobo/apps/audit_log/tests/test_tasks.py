from datetime import timedelta
from unittest.mock import Mock, call, patch

from constance.test import override_config
from django.test import override_settings
from django.utils import timezone

from kobo.apps.audit_log.tasks import spawn_access_log_cleaning_tasks
from kobo.apps.audit_log.tests.test_utils import (
    create_access_log_from_user_with_metadata,
    create_submission_group_log,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


@override_config(ACCESS_LOG_LIFESPAN=1)
class AuditLogTasksTestCase(BaseTestCase):

    fixtures = ['test_data']

    def get_ids_queued_for_deletion(self, patched_task: Mock):
        """
        Given a patched version of batch_delete_audit_logs_by_id, get all the ids it was called with
        """
        # get the list of ids passed for each call
        id_lists = [kwargs['ids'] for _, _, kwargs in patched_task.mock_calls]
        # flatten the list
        all_ids = [log_id for id_list in id_lists for log_id in id_list]
        return all_ids

    def test_spawn_new_deletion_task_correctly_identifies_expired_regular_logs(
        self,
    ):
        user = User.objects.get(username='someuser')
        three_days_ago = timezone.now() - timedelta(days=3)
        old_log = create_access_log_from_user_with_metadata(
            user=user, metadata_dict={'auth_type': 'token'}
        )
        old_log.date_created = three_days_ago
        old_log.save()
        new_log = create_access_log_from_user_with_metadata(
            user=user, metadata_dict={'auth_type': 'token'}
        )
        new_log.save()
        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_access_log_cleaning_tasks()
        deleted_ids = self.get_ids_queued_for_deletion(patched_spawned_task)
        self.assertIn(old_log.id, deleted_ids)
        self.assertNotIn(new_log.id, deleted_ids)

    def test_spawn_new_deletion_task_correctly_identifies_expired_submission_group_logs(
        self,
    ):
        user = User.objects.get(username='someuser')
        three_days_ago = timezone.now() - timedelta(days=3)
        two_days_ago = timezone.now() - timedelta(days=2)
        old_log = create_submission_group_log(
            user=user, latest_date=two_days_ago
        )
        old_log.date_created = three_days_ago
        old_log.save()
        # mock up a submission group that was created before the expiration cutoff
        # but whose latest entry is more recent
        newer_log = create_submission_group_log(
            user=user, latest_date=timezone.now()
        )
        newer_log.date_created = two_days_ago
        newer_log.save()
        # both date_created and latest entry are after the expiration cut off
        newest_log = create_submission_group_log(
            user=user, latest_date=timezone.now()
        )
        newest_log.save()
        newest_log.save()
        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_access_log_cleaning_tasks()
        deleted_ids = self.get_ids_queued_for_deletion(patched_spawned_task)
        self.assertIn(old_log.id, deleted_ids)
        self.assertNotIn(newer_log.id, deleted_ids)
        self.assertNotIn(newest_log.id, deleted_ids)

    @override_settings(ACCESS_LOG_DELETION_BATCH_SIZE=2)
    def test_spawn_new_deletion_tasks_batches_expired_logs(self):
        two_days_ago = timezone.now() - timedelta(days=2)
        three_days_ago = timezone.now() - timedelta(days=3)
        user = User.objects.get(username='someuser')

        old_logs = [
            create_access_log_from_user_with_metadata(
                user=user, metadata_dict={'auth_type': 'token'}
            )
            for i in range(5)
        ]
        for old_regular_log in old_logs:
            # set the creation date to something before 2 days ago
            # all these should be queued for deletion
            old_regular_log.date_created = three_days_ago
            old_regular_log.save()
        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_access_log_cleaning_tasks()
        # 3 tasks should be spawned with 2 ids for the first two and 1 id for the third
        self.assertEqual(patched_spawned_task.call_count, 3)
        id_lists = [
            kwargs['ids'] for _, _, kwargs in patched_spawned_task.mock_calls
        ]
        for id_list in id_lists:
            self.assertLessEqual(len(id_list), 2)
        all_ids = [log_id for id_list in id_lists for log_id in id_list]
        # if there are exactly 5 ids total and all the logs in old_logs are present, we can safely say each log id
        # was passed to exactly one task
        self.assertEqual(len(all_ids), 5)
        for log in old_logs:
            self.assertIn(log.id, all_ids)
