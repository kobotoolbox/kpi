from datetime import timedelta
from unittest.mock import patch

from constance import config
from ddt import data, ddt, unpack
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django_celery_beat.models import PeriodicTask
from freezegun import freeze_time

from kobo.apps.audit_log.models import AuditAction, AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus

from kpi.models import Asset
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin
from ..constants import DELETE_PROJECT_STR_PREFIX, DELETE_USER_STR_PREFIX
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.attachment import AttachmentTrash
from ..models.project import ProjectTrash
from ..tasks import (
    empty_account,
    empty_attachment,
    empty_project,
    task_restarter,
)
from ..utils import move_to_trash, put_back, trash_bin_task_failure


@ddt
class AccountTrashTestCase(TestCase):

    fixtures = ['test_data']

    def test_delete_user(self):
        """
        Test everything related to user is deleted even their account
        """
        someuser = get_user_model().objects.get(username='someuser')
        someuser_uid = someuser.extra_details.uid
        someuser_id = someuser.pk
        admin = get_user_model().objects.get(username='adminuser')

        # Create dummy logs for someuser
        audit_log = AuditLog.objects.create(
            app_label='foo',
            model_name='bar',
            object_id=1,
            user=someuser,
            log_type=AuditType.ACCESS,
        )

        grace_period = 0
        assert someuser.assets.count() == 2
        assert not AccountTrash.objects.filter(user=someuser).exists()
        move_to_trash(
            request_author=admin,
            objects_list=[
                {
                    'pk': someuser.pk,
                    'username': someuser.username,
                }
            ],
            grace_period=grace_period,
            trash_type='user',
            retain_placeholder=False,
        )
        account_trash = AccountTrash.objects.get(user=someuser)
        empty_account.apply([account_trash.pk])

        assert not get_user_model().objects.filter(pk=someuser_id).exists()
        assert not Asset.objects.filter(owner_id=someuser_id).exists()
        assert not AccountTrash.objects.filter(user_id=someuser_id).exists()

        # Ensure logs have been anonymized
        audit_log.refresh_from_db()
        assert audit_log.user is None
        assert audit_log.user_uid == someuser_uid

    def test_move_to_trash(self):
        someuser = get_user_model().objects.get(username='someuser')
        someuser_id = someuser.pk
        grace_period = 1
        assert not AccountTrash.objects.filter(user=someuser).exists()

        before = timezone.now()
        move_to_trash(
            request_author=someuser,
            objects_list=[
                {
                    'pk': someuser.pk,
                    'username': someuser.username,
                }
            ],
            grace_period=grace_period,
            trash_type='user',
        )
        after = timezone.now()

        someuser.refresh_from_db()
        assert not someuser.is_active
        assert before <= someuser.extra_details.date_removal_requested <= after

        # Ensure someuser is in trash and a periodic task exists and is ready to run
        account_trash = AccountTrash.objects.get(user=someuser)
        assert (
            before + timedelta(days=grace_period)
            <= account_trash.periodic_task.clocked.clocked_time
            <= after + timedelta(days=grace_period)
        )
        assert account_trash.periodic_task.name.startswith(DELETE_USER_STR_PREFIX)

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='kobo_auth',
            model_name='user',
            object_id=someuser_id,
            user=someuser,
            action=AuditAction.IN_TRASH,
            log_type=AuditType.USER_MANAGEMENT,
        ).exists()

    def test_put_back(self):
        self.test_move_to_trash()
        someuser = get_user_model().objects.get(username='someuser')
        admin = get_user_model().objects.get(username='adminuser')
        assert not someuser.is_active
        account_trash = AccountTrash.objects.get(user=someuser)
        periodic_task_id = account_trash.periodic_task_id

        put_back(
            request_author=admin,
            objects_list=[
                {
                    'pk': someuser.pk,
                    'username': someuser.username,
                }
            ],
            trash_type='user',
        )

        someuser.refresh_from_db()
        assert someuser.is_active

        # Ensure someuser is not in trash anymore
        assert not AccountTrash.objects.filter(user=someuser).exists()
        assert not PeriodicTask.objects.filter(pk=periodic_task_id).exists()

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='kobo_auth',
            model_name='user',
            object_id=someuser.pk,
            user=admin,
            action=AuditAction.PUT_BACK,
            log_type=AuditType.USER_MANAGEMENT,
        ).exists()

    def test_remove_user(self):
        """
        Test related objects to user are deleted and user is anonymized, i.e.:
        everything from their account is deleted except their username
        """
        someuser = get_user_model().objects.get(username='someuser')
        admin = get_user_model().objects.get(username='adminuser')
        someuser.extra_details.data['name'] = 'someuser'
        someuser.extra_details.save(update_fields=['data'])

        grace_period = 0
        assert someuser.assets.count() == 2
        assert not AccountTrash.objects.filter(user=someuser).exists()

        before = timezone.now() + timedelta(days=grace_period)
        move_to_trash(
            request_author=admin,
            objects_list=[
                {
                    'pk': someuser.pk,
                    'username': someuser.username,
                }
            ],
            grace_period=grace_period,
            trash_type='user',
            retain_placeholder=True,
        )
        account_trash = AccountTrash.objects.get(user=someuser)
        empty_account.apply([account_trash.pk])
        after = timezone.now() + timedelta(days=grace_period)

        someuser.refresh_from_db()
        assert not someuser.is_active
        assert someuser.assets.count() == 0
        assert someuser.email == ''
        assert someuser.extra_details.data.get('name') == ''

        assert not AccountTrash.objects.filter(user=someuser).exists()
        assert before <= someuser.extra_details.date_removed <= after

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='kobo_auth',
            model_name='user',
            object_id=someuser.pk,
            user=admin,
            action=AuditAction.REMOVE,
            log_type=AuditType.USER_MANAGEMENT,
        ).exists()

    @data(
        # Format: (task status, within grace period, is stuck, expected restart count)

        # Trivial case: Task is pending and still within the grace period
        (TrashStatus.PENDING, False, False, 0),
        # Task is pending but the grace period has expired — it should be restarted
        (TrashStatus.PENDING, True, False, 1),
        # Task has started and is still running normally
        (TrashStatus.IN_PROGRESS, True, False, 0),
        # Task has started but is now stuck — it should be restarted
        (TrashStatus.IN_PROGRESS, True, True, 1),
        # Task failed but is not considered stuck — no restart needed
        (TrashStatus.FAILED, True, False, 0),
        # Task failed and is considered stuck — still no restart (handled differently)
        (TrashStatus.FAILED, True, True, 0),
    )
    @unpack
    def test_task_restarter(self, status, is_time_frozen, is_stuck, restart_count):
        """
        A freshly created task should not be restarted if it is in grace period.
        """
        someuser = get_user_model().objects.get(username='someuser')
        grace_period = config.ACCOUNT_TRASH_GRACE_PERIOD
        admin = get_user_model().objects.get(username='adminuser')

        if is_time_frozen:
            frozen_time = '2023-12-10'
        else:
            frozen_time = str(timezone.now())

        with freeze_time(frozen_time):
            move_to_trash(
                request_author=admin,
                objects_list=[
                    {
                        'pk': someuser.pk,
                        'username': someuser.username,
                    }
                ],
                grace_period=grace_period,
                trash_type='user',
                retain_placeholder=True,
            )

        if status != TrashStatus.PENDING:
            # Only tasks that are not pending can be considered as stuck
            if is_stuck:
                # Fake the task was started but is now stuck (its last run is older than
                # the expected threshold).
                last_run = timezone.now() - timedelta(
                    seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5 + 10
                )
            else:
                last_run = timezone.now()

            AccountTrash.objects.filter(user=someuser).update(
                status=status,
                date_modified=last_run,
            )

        with patch('kobo.apps.trash_bin.tasks.empty_account', return_value=True):
            with patch(
                'kobo.apps.trash_bin.tasks.empty_account.delay'
            ) as patched_spawned_task:
                task_restarter()

                assert patched_spawned_task.call_count == restart_count

    def test_status_on_error_when_killed(self):
        someuser = get_user_model().objects.get(username='someuser')
        admin = get_user_model().objects.get(username='adminuser')
        assert someuser.assets.count() == 2
        move_to_trash(
            request_author=admin,
            objects_list=[
                {
                    'pk': someuser.pk,
                    'username': someuser.username,
                }
            ],
            grace_period=1,
            trash_type='user',
            retain_placeholder=False,
        )
        account_trash = AccountTrash.objects.get(user=someuser)
        assert account_trash.status == TrashStatus.PENDING
        trash_bin_task_failure(
            AccountTrash,
            args=[account_trash.pk],
            exception='Worker exited prematurely',
        )
        account_trash.refresh_from_db()
        assert account_trash.status == TrashStatus.IN_PROGRESS
        trash_bin_task_failure(
            AccountTrash, args=[account_trash.pk], exception='Random error'
        )
        account_trash.refresh_from_db()
        assert account_trash.status == TrashStatus.FAILED


@ddt
class ProjectTrashTestCase(TestCase, AssetSubmissionTestMixin):

    fixtures = ['test_data']

    def test_move_to_trash(self):
        asset = Asset.objects.get(pk=1)
        asset.save()  # create a version
        asset.deploy(backend='mock', active=True)
        asset.deployment.mock_submissions(
            [
                {
                    'q1': 'foo',
                    'q2': 'bar',
                }
            ]
        )

        grace_period = 1
        assert not ProjectTrash.objects.filter(asset=asset).exists()
        assert not asset.pending_delete
        assert not asset.deployment.xform.pending_delete

        before = timezone.now() + timedelta(days=grace_period)
        move_to_trash(
            request_author=asset.owner,
            objects_list=[
                {
                    'pk': asset.pk,
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                }
            ],
            grace_period=grace_period,
            trash_type='asset',
        )
        after = timezone.now() + timedelta(days=grace_period)

        asset.refresh_from_db()
        asset.deployment.xform.refresh_from_db()
        assert asset.pending_delete
        assert asset.deployment.xform.pending_delete

        # Ensure project is in trash and a periodic task exists and is ready to run
        project_trash = ProjectTrash.objects.get(asset=asset)
        assert before <= project_trash.periodic_task.clocked.clocked_time <= after
        assert project_trash.periodic_task.name.startswith(
            DELETE_PROJECT_STR_PREFIX
        )

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='kpi',
            model_name='asset',
            object_id=asset.pk,
            user=asset.owner,
            action=AuditAction.IN_TRASH,
            log_type=AuditType.ASSET_MANAGEMENT,
        ).exists()

        return project_trash

    def test_put_back(self):
        self.test_move_to_trash()
        asset = Asset.all_objects.get(pk=1)
        assert asset.pending_delete
        assert asset.deployment.xform.pending_delete
        project_trash = ProjectTrash.objects.get(asset=asset)
        periodic_task_id = project_trash.periodic_task_id

        put_back(
            request_author=asset.owner,
            objects_list=[
                {
                    'pk': asset.pk,
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                }
            ],
            trash_type='asset',
        )

        asset.refresh_from_db()
        asset.deployment.xform.refresh_from_db()
        assert not asset.pending_delete
        assert not asset.deployment.xform.pending_delete

        # Ensure the project is not in trash anymore
        assert not ProjectTrash.objects.filter(asset=asset).exists()
        assert not PeriodicTask.objects.filter(pk=periodic_task_id).exists()

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='kpi',
            model_name='asset',
            object_id=asset.pk,
            user=asset.owner,
            action=AuditAction.PUT_BACK,
            log_type=AuditType.ASSET_MANAGEMENT,
        ).exists()

    def test_delete_project(self):

        project_trash = self.test_move_to_trash()
        asset_uid = project_trash.asset.uid
        xform_queryset = XForm.all_objects.filter(kpi_asset_uid=asset_uid)
        xform_ids = list(xform_queryset.values_list('pk', flat=True))
        mongo_userform_id = project_trash.asset.deployment.mongo_userform_id

        assert Asset.all_objects.filter(uid=asset_uid).exists()
        assert xform_queryset.exists()
        assert Instance.objects.filter(xform_id__in=xform_ids)
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': mongo_userform_id}
            )
            >= 0
        )
        empty_project(project_trash.pk)
        assert not Asset.all_objects.filter(uid=asset_uid).exists()
        assert not xform_queryset.exists()
        assert not Instance.objects.filter(xform_id__in=xform_ids)
        assert (
            settings.MONGO_DB.instances.count_documents(
                {'_userform_id': mongo_userform_id}
            )
            == 0
        )

    @data(
        # Format: (task status, within grace period, is stuck, expected restart count)
        # Trivial case: Task is pending and still within the grace period
        (TrashStatus.PENDING, False, False, 0),
        # Task is pending but the grace period has expired — it should be restarted
        (TrashStatus.PENDING, True, False, 1),
        # Task has started and is still running normally
        (TrashStatus.IN_PROGRESS, True, False, 0),
        # Task has started but is now stuck — it should be restarted
        (TrashStatus.IN_PROGRESS, True, True, 1),
        # Task failed but is not considered stuck — no restart needed
        (TrashStatus.FAILED, True, False, 0),
        # Task failed and is considered stuck — still no restart (handled differently)
        (TrashStatus.FAILED, True, True, 0),
    )
    @unpack
    def test_task_restarter(self, status, is_time_frozen, is_stuck, restart_count):
        """
        A freshly created task should not be restarted if it is in grace period.
        """
        someuser = get_user_model().objects.get(username='someuser')
        asset = someuser.assets.first()
        grace_period = config.PROJECT_TRASH_GRACE_PERIOD

        if is_time_frozen:
            frozen_time = '2024-12-10'
        else:
            frozen_time = str(timezone.now())

        with freeze_time(frozen_time):
            move_to_trash(
                request_author=asset.owner,
                objects_list=[
                    {
                        'pk': asset.pk,
                        'asset_uid': asset.uid,
                        'asset_name': asset.name,
                    }
                ],
                grace_period=grace_period,
                trash_type='asset',
            )

        if status != TrashStatus.PENDING:
            # Only tasks that are not pending can be considered as stuck
            if is_stuck:
                # Fake the task was started but is now stuck (its last run is older than
                # the expected threshold).
                last_run = timezone.now() - timedelta(
                    seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5 + 10
                )
            else:
                last_run = timezone.now()

            ProjectTrash.objects.filter(asset=asset).update(
                status=status,
                date_modified=last_run,
            )

        with patch('kobo.apps.trash_bin.tasks.empty_project', return_value=True):
            with patch(
                'kobo.apps.trash_bin.tasks.empty_project.delay'
            ) as patched_spawned_task:
                task_restarter()

                assert patched_spawned_task.call_count == restart_count

    def test_storage_updates_on_project_trash_and_restore(self):
        """
        Test that attachment storage counter in UserProfile is cleared on trash,
        and restored properly on untrash. Counter on xform remains unchanged.
        """
        asset, xform, instance, user_profile, attachment = (
            self._create_test_asset_and_submission(
                user=User.objects.get(username='someuser')
            )
        )

        xform_storage_init = xform.attachment_storage_bytes
        user_storage_init = user_profile.attachment_storage_bytes
        self.assertGreater(xform_storage_init, 0)
        self.assertGreater(user_storage_init, 0)

        # Move the project to trash
        move_to_trash(
            request_author=asset.owner,
            objects_list=[
                {
                    'pk': asset.pk,
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                }
            ],
            grace_period=1,
            trash_type='asset',
        )
        xform.refresh_from_db()
        user_profile.refresh_from_db()
        self.assertEqual(xform.attachment_storage_bytes, xform_storage_init)
        self.assertEqual(user_profile.attachment_storage_bytes, 0)

        # Restore the project
        put_back(
            request_author=asset.owner,
            objects_list=[
                {
                    'pk': asset.pk,
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                }
            ],
            trash_type='asset',
        )
        xform.refresh_from_db()
        user_profile.refresh_from_db()
        self.assertEqual(xform.attachment_storage_bytes, xform_storage_init)
        self.assertGreater(user_profile.attachment_storage_bytes, 0)
        self.assertEqual(xform_storage_init, xform.attachment_storage_bytes)
        self.assertEqual(user_storage_init, user_profile.attachment_storage_bytes)

    def test_storage_does_not_change_on_archive_unarchive(self):
        """
        Test that attachment storage counters in XForm and UserProfile remain
        unchanged when a project is archived or unarchived
        """
        asset, xform, instance, user_profile, attachment = (
            self._create_test_asset_and_submission(
                user=User.objects.get(username='someuser')
            )
        )

        xform_storage_init = xform.attachment_storage_bytes
        user_storage_init = user_profile.attachment_storage_bytes
        self.assertGreater(xform_storage_init, 0)
        self.assertGreater(user_storage_init, 0)

        # Simulate archiving the project by updating the status
        ProjectTrash.toggle_statuses(
            [asset.uid], active=False, toggle_delete=False
        )
        xform.refresh_from_db()
        user_profile.refresh_from_db()
        self.assertEqual(xform_storage_init, xform.attachment_storage_bytes)
        self.assertEqual(user_storage_init, user_profile.attachment_storage_bytes)

        # Simulate unarchiving the project by updating the status
        ProjectTrash.toggle_statuses(
            [asset.uid], active=True, toggle_delete=False
        )
        xform.refresh_from_db()
        user_profile.refresh_from_db()
        self.assertEqual(xform_storage_init, xform.attachment_storage_bytes)
        self.assertEqual(user_storage_init, user_profile.attachment_storage_bytes)

    def test_status_on_error_when_killed(self):
        someuser = get_user_model().objects.get(username='someuser')
        asset = someuser.assets.first()
        move_to_trash(
            request_author=asset.owner,
            objects_list=[
                {
                    'pk': asset.pk,
                    'asset_uid': asset.uid,
                    'asset_name': asset.name,
                }
            ],
            grace_period=1,
            trash_type='asset',
        )
        project_trash = ProjectTrash.objects.get(asset=asset)
        assert project_trash.status == TrashStatus.PENDING
        trash_bin_task_failure(
            ProjectTrash,
            args=[project_trash.pk],
            exception='Worker exited prematurely',
        )
        project_trash.refresh_from_db()
        assert project_trash.status == TrashStatus.IN_PROGRESS
        trash_bin_task_failure(
            ProjectTrash, args=[project_trash.pk], exception='Random error'
        )
        project_trash.refresh_from_db()
        assert project_trash.status == TrashStatus.FAILED


@ddt
class AttachmentTrashTestCase(TestCase, AssetSubmissionTestMixin):
    def setUp(self):
        self.user = User.objects.create(username='user', password='password')
        self.asset, self.xform, self.instance, self.user_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.user)
        )

    def test_move_to_trash(self):
        assert self.xform.attachment_storage_bytes > 0
        assert self.user_profile.attachment_storage_bytes > 0
        assert not self.attachment.delete_status
        assert not AttachmentTrash.objects.filter(
            attachment_id=self.attachment.id
        ).exists()

        self._move_attachment_to_trash(self.attachment, self.user)

        assert self.xform.attachment_storage_bytes == 0
        assert self.user_profile.attachment_storage_bytes == 0
        assert self.attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE
        assert AttachmentTrash.objects.filter(
            attachment_id=self.attachment.id
        ).exists()

        assert AuditLog.objects.filter(
            app_label='logger',
            model_name='attachment',
            object_id=self.attachment.pk,
            user=self.user,
            action=AuditAction.IN_TRASH,
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
        ).exists()

    def test_put_back(self):
        trash_obj = self._move_attachment_to_trash(self.attachment, self.user)
        self._put_back_attachment_from_trash(self.attachment, self.user)

        assert not self.attachment.delete_status
        assert self.xform.attachment_storage_bytes > 0
        assert self.user_profile.attachment_storage_bytes > 0
        assert not AttachmentTrash.objects.filter(
            attachment_id=self.attachment.id
        ).exists()
        assert not PeriodicTask.objects.filter(
            pk=trash_obj.periodic_task_id
        ).exists()

        assert AuditLog.objects.filter(
            app_label='logger',
            model_name='attachment',
            object_id=self.attachment.pk,
            user=self.user,
            action=AuditAction.PUT_BACK,
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
        ).exists()

    def test_trashing_attachment_deletes_file_but_preserves_db_object(self):
        """
        Test that moving an attachment to trash removes the file from storage
        but not the attachment object itself
        """
        media_file = self.attachment.media_file
        assert self.attachment.media_file.storage.exists(str(media_file))

        trash_obj = self._move_attachment_to_trash(self.attachment, self.user)
        empty_attachment(trash_obj.pk)

        assert Attachment.all_objects.filter(pk=self.attachment.pk).exists()
        assert not self.attachment.media_file.storage.exists(str(media_file))
        assert not AttachmentTrash.objects.filter(
            attachment_id=self.attachment.pk
        ).exists()

        assert AuditLog.objects.filter(
            app_label='logger',
            model_name='attachment',
            object_id=self.attachment.pk,
            user=self.user,
            action=AuditAction.DELETE,
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
            metadata={
                'attachment_uid': self.attachment.uid,
                'attachment_name': self.attachment.media_file_basename,
                'instance__root_uuid': self.attachment.instance.root_uuid,
            },
        ).exists()

    @data(
        # Format: (task status, is time frozen, is stuck, expected restart count)
        # `is_time_frozen=True` simulates a past time (grace period expired)
        # `is_time_frozen=False` uses current time (still within grace period)

        # Trivial case: Task is pending and still within the grace period
        (TrashStatus.PENDING, False, False, 0),
        # Task is pending but the grace period has expired — it should be restarted
        (TrashStatus.PENDING, True, False, 1),
        # Task has started and is still running normally
        (TrashStatus.IN_PROGRESS, True, False, 0),
        # Task has started but is now stuck — it should be restarted
        (TrashStatus.IN_PROGRESS, True, True, 1),
        # Task failed but is not considered stuck — no restart needed
        (TrashStatus.FAILED, True, False, 0),
        # Task failed and is considered stuck — still no restart (handled differently)
        (TrashStatus.FAILED, True, True, 0),
    )
    @unpack
    def test_task_restarter(self, status, is_time_frozen, is_stuck, restart_count):
        """
        A freshly created task should not be restarted if it is in grace period.
        """
        if is_time_frozen:
            # Freeze time to simulate that the grace period has passed.
            # This allows us to test behavior after grace period expiration.
            frozen_time = '2024-12-10'
        else:
            # Use the current time, meaning the task is still within its grace period.
            frozen_time = str(timezone.now())

        with freeze_time(frozen_time):
            self._move_attachment_to_trash(self.attachment, self.user)

        if status != TrashStatus.PENDING:
            # Only tasks that are not pending can be considered as stuck
            if is_stuck:
                # Simulate a stuck task by setting its last run time far beyond
                # the allowed execution window: Add a buffer of 5 mins + 10 secs
                # to the CELERY time limit to ensure it's well overdue.
                last_run = timezone.now() - timedelta(
                    seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5 + 10
                )
            else:
                last_run = timezone.now()

            AttachmentTrash.objects.filter(attachment_id=self.attachment.id).update(
                status=status,
                date_modified=last_run,
            )

        with patch('kobo.apps.trash_bin.tasks.empty_attachment', return_value=True):
            with patch(
                'kobo.apps.trash_bin.tasks.empty_attachment.delay'
            ) as patched_spawned_task:
                task_restarter()

                assert patched_spawned_task.call_count == restart_count

    def _move_attachment_to_trash(self, attachment, user):
        move_to_trash(
            request_author=user,
            objects_list=[{
                'pk': attachment.pk,
                'attachment_uid': attachment.uid,
                'attachment_basename': attachment.media_file_basename,
            }],
            grace_period=config.ATTACHMENT_TRASH_GRACE_PERIOD,
            trash_type='attachment',
            retain_placeholder=False,
        )
        self._refresh_all()
        return AttachmentTrash.objects.get(attachment_id=attachment.pk)

    def _put_back_attachment_from_trash(self, attachment, user):
        put_back(
            request_author=user,
            objects_list=[{
                'pk': attachment.pk,
                'attachment_uid': attachment.uid,
                'attachment_basename': attachment.media_file_basename,
            }],
            trash_type='attachment',
        )
        self._refresh_all()

    def _refresh_all(self):
        """
        Refresh all test objects from the database to get updated values
        """
        self.asset.refresh_from_db()
        self.xform.refresh_from_db()
        self.user_profile.refresh_from_db()
        self.attachment.refresh_from_db()
