from datetime import timedelta
from unittest.mock import Mock, call, patch

from constance.test import override_config
from django.test import override_settings
from django.utils import timezone

from kobo.apps.audit_log.models import (
    AccessLog,
    SubmissionAccessLog,
    SubmissionGroup,
)
from kobo.apps.audit_log.tasks import (
    batch_delete_audit_logs_by_id,
    get_empty_submission_group_ids,
    remove_expired_submissions_from_groups,
    spawn_access_log_cleaning_tasks,
)
from kobo.apps.audit_log.tests.test_utils import skip_all_signals
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

    @patch('kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay')
    def test_spawn_deletion_task_deletes_expired_groups(self, patched_delete):
        # basic plumbing test to make sure we are getting and deleting expired groups
        with patch(
            'kobo.apps.audit_log.tasks.get_empty_submission_group_ids',
            return_value=[1, 2],
        ):
            spawn_access_log_cleaning_tasks()
        ids = self.get_ids_queued_for_deletion(patched_delete)
        self.assertEquals(ids, [1, 2])

    def test_spawn_deletion_task_identifies_expired_logs(self):
        user = User.objects.get(username='someuser')
        three_days_ago = timezone.now() - timedelta(days=3)
        old_log = AccessLog.objects.create(
            user=user,
            metadata={'auth_type': 'token'},
            date_created=three_days_ago,
        )
        new_log = AccessLog.objects.create(
            user=user, metadata={'auth_type': 'token'}
        )

        with patch(
            'kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay'
        ) as patched_spawned_task:
            spawn_access_log_cleaning_tasks()
        deleted_ids = self.get_ids_queued_for_deletion(patched_spawned_task)
        self.assertIn(old_log.id, deleted_ids)
        self.assertNotIn(new_log.id, deleted_ids)

    def test_remove_expired_submissions_from_groups(self):
        user = User.objects.get(username='someuser')
        expiration_date = timezone.now() - timedelta(days=1)
        three_days_ago = timezone.now() - timedelta(days=3)
        with skip_all_signals():
            # skip signals so we can manually assign submissions to groups
            group = SubmissionGroup.objects.create(user=user)
            group.submission_group = group
            group.save()
            old_log = SubmissionAccessLog.objects.create(
                user=user, date_created=three_days_ago, submission_group=group
            )
            new_log = SubmissionAccessLog.objects.create(
                user=user, submission_group=group
            )
        remove_expired_submissions_from_groups(expiration_date)
        self.assertEqual(group.submissions.count(), 2)
        self.assertIn(new_log, group.submissions.all())
        self.assertNotIn(old_log, group.submissions.all())

    def test_get_empty_submission_group_ids(self):
        user = User.objects.get(username='someuser')

        with skip_all_signals():
            # skip post_save signals so we can manually assign submissions to groups
            group_to_delete = SubmissionGroup.objects.create(user=user)
            group_to_delete.submission_group = group_to_delete
            group_to_delete.save()

            group_to_keep = SubmissionGroup.objects.create(user=user)
            group_to_keep.submission_group = group_to_keep
            group_to_keep.save()

            SubmissionAccessLog.objects.create(
                user=user,
                submission_group=group_to_keep,
            )

        empty = get_empty_submission_group_ids()
        self.assertEqual(list(empty), [group_to_delete.id])

    @override_settings(ACCESS_LOG_DELETION_BATCH_SIZE=2)
    @patch('kobo.apps.audit_log.tasks.batch_delete_audit_logs_by_id.delay')
    def test_spawn_task_batches_ids(self, patched_task):
        three_days_ago = timezone.now() - timedelta(days=3)
        user = User.objects.get(username='someuser')
        old_log_1 = AccessLog.objects.create(
            user=user, date_created=three_days_ago
        )
        old_log_2 = AccessLog.objects.create(
            user=user, date_created=three_days_ago
        )
        old_log_3 = AccessLog.objects.create(
            user=user, date_created=three_days_ago
        )
        group1 = SubmissionGroup.objects.create(user=user)
        group2 = SubmissionGroup.objects.create(user=user)
        group3 = SubmissionGroup.objects.create(user=user)
        # force deletion of the 3 groups
        with patch(
            'kobo.apps.audit_log.tasks.get_empty_submission_group_ids',
            return_value=[group1.id, group2.id, group3.id],
        ):
            spawn_access_log_cleaning_tasks()

        # groups are batched separately from other logs, so it will be 2 batches for the groups
        # and 2 for the other logs
        self.assertEquals(patched_task.call_count, 4)
        # make sure all batches were <= ACCESS_LOG_DELETION_BATCH_SIZE
        for task_call in patched_task.mock_calls:
            _, _, kwargs = task_call
            id_list = kwargs['ids']
            self.assertLessEqual(len(id_list), 2)

        # make sure we queued everything for deletion
        all_deleted_ids = self.get_ids_queued_for_deletion(patched_task)
        self.assertIn(old_log_1.id, all_deleted_ids)
        self.assertIn(old_log_2.id, all_deleted_ids)
        self.assertIn(old_log_3.id, all_deleted_ids)
        self.assertIn(group1.id, all_deleted_ids)
        self.assertIn(group2.id, all_deleted_ids)
        self.assertIn(group3.id, all_deleted_ids)

    def test_batch_delete_audit_logs_by_id(self):
        user = User.objects.get(username='someuser')
        log_1 = AccessLog.objects.create(user=user)
        log_2 = AccessLog.objects.create(user=user)
        log_3 = AccessLog.objects.create(user=user)
        self.assertEquals(AccessLog.objects.count(), 3)

        batch_delete_audit_logs_by_id(ids=[log_1.id, log_2.id])
        # only log_3 should remain
        self.assertEquals(AccessLog.objects.count(), 1)
        self.assertEquals(AccessLog.objects.first().id, log_3.id)
