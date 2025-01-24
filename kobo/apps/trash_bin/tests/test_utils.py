# coding: utf-8
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils.timezone import now
from django_celery_beat.models import PeriodicTask

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kpi.models import Asset
from ..constants import DELETE_PROJECT_STR_PREFIX, DELETE_USER_STR_PREFIX
from ..models.account import AccountTrash
from ..models.project import ProjectTrash
from ..tasks import empty_account
from ..utils import move_to_trash, put_back


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
        AccountTrash.toggle_user_statuses([someuser.pk], active=False)
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
        with patch('kobo.apps.trash_bin.tasks.delete_kc_user') as mock_delete_kc_user:
            mock_delete_kc_user.return_value = True
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

        before = now()
        AccountTrash.toggle_user_statuses([someuser.pk], active=False)
        someuser.refresh_from_db()
        assert not someuser.is_active
        after = now()
        assert before <= someuser.extra_details.date_removal_requested <= after

        before = now() + timedelta(days=grace_period)
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
        after = now() + timedelta(days=grace_period)

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

        AccountTrash.toggle_user_statuses([someuser.pk], active=True)
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

        before = now() + timedelta(days=grace_period)
        AccountTrash.toggle_user_statuses([someuser.pk], active=False)
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
        with patch('kobo.apps.trash_bin.tasks.delete_kc_user') as mock_delete_kc_user:
            mock_delete_kc_user.return_value = True
            empty_account.apply([account_trash.pk])
        after = now() + timedelta(days=grace_period)

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


class ProjectTrashTestCase(TestCase):

    fixtures = ['test_data']

    def test_move_to_trash(self):
        asset = Asset.objects.get(pk=1)
        grace_period = 1
        assert not ProjectTrash.objects.filter(asset=asset).exists()
        assert not asset.pending_delete
        ProjectTrash.toggle_asset_statuses(
            [asset.uid], active=False, toggle_delete=True
        )

        asset.refresh_from_db()
        assert asset.pending_delete

        before = now() + timedelta(days=grace_period)
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
        after = now() + timedelta(days=grace_period)

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

    def test_put_back(self):
        self.test_move_to_trash()
        asset = Asset.all_objects.get(pk=1)
        assert asset.pending_delete
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
        ProjectTrash.toggle_asset_statuses(
            [asset.uid], active=True, toggle_delete=True
        )
        asset.refresh_from_db()
        assert not asset.pending_delete

        # Ensure project is not in trash anymore
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
