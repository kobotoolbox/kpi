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
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.models import Asset
from ..constants import DELETE_PROJECT_STR_PREFIX, DELETE_USER_STR_PREFIX
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.project import ProjectTrash
from ..tasks import empty_account, empty_project, task_restarter
from ..utils import move_to_trash, put_back


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
        AccountTrash.toggle_statuses([someuser.pk], active=False)
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
        AccountTrash.toggle_statuses([someuser.pk], active=False)
        someuser.refresh_from_db()
        assert not someuser.is_active
        after = timezone.now()
        assert before <= someuser.extra_details.date_removal_requested <= after

        before = timezone.now() + timedelta(days=grace_period)
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
        after = timezone.now() + timedelta(days=grace_period)

        # Ensure someuser is in trash and a periodic task exists and is ready to run
        account_trash = AccountTrash.objects.get(user=someuser)
        assert before <= account_trash.periodic_task.clocked.clocked_time <= after
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

        AccountTrash.toggle_statuses([someuser.pk], active=True)
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
        AccountTrash.toggle_statuses([someuser.pk], active=False)
        someuser.refresh_from_db()
        assert not someuser.is_active

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


@ddt
class ProjectTrashTestCase(TestCase):

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
        ProjectTrash.toggle_statuses(
            [asset.uid], active=False, toggle_delete=True
        )

        asset.refresh_from_db()
        asset.deployment.xform.refresh_from_db()
        assert asset.pending_delete
        assert asset.deployment.xform.pending_delete

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
        ProjectTrash.toggle_statuses(
            [asset.uid], active=True, toggle_delete=True
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
