from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils.timezone import now
from django_celery_beat.models import PeriodicTask
from rest_framework import status

from kobo.apps.audit_log.models import AuditAction, AuditLog, AuditType
from kobo.apps.openrosa.apps.api.viewsets.data_viewset import DataViewSet
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase

from kpi.models import Asset
from ..constants import DELETE_PROJECT_STR_PREFIX, DELETE_USER_STR_PREFIX
from ..models.account import AccountTrash
from ..models.attachment import AttachmentTrash
from ..models.project import ProjectTrash
from ..tasks import empty_account, empty_project
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

        before = now()
        AccountTrash.toggle_statuses([someuser.pk], active=False)
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

        before = now() + timedelta(days=grace_period)
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


class TestAttachmentTrashStorageCounters(TestBase):
    """
    Test that AttachmentTrash.toggle_statuses() correctly updates storage
    counters and attachment statuses when moving to trash or restoring
    """
    def setUp(self):
        super().setUp()
        self._create_user_and_login()
        self._publish_transportation_form()
        self._submit_transport_instance_w_attachment()
        self.user_profile = UserProfile.objects.get(user=self.xform.user)
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token
        }

    def _refresh_all(self):
        """
        Refresh all relevant objects from the database to get updated values.
        """
        self.attachment.refresh_from_db()
        self.xform.refresh_from_db()
        self.user_profile.refresh_from_db()

    def test_toggle_statuses_updates_storage_counters(self):
        """
        Toggling an attachment to trash should decrease storage counters.
        Toggling it back should restore them.
        """
        # Check initial values
        self._refresh_all()
        self.assertIsNotNone(self.attachment.media_file_size)
        self.assertGreater(self.xform.attachment_storage_bytes, 0)
        self.assertGreater(self.user_profile.attachment_storage_bytes, 0)
        original_xform_bytes = self.xform.attachment_storage_bytes
        original_user_bytes = self.user_profile.attachment_storage_bytes

        # Move to trash
        AttachmentTrash.toggle_statuses([self.attachment.uid])
        self._refresh_all()

        # Counters should be decremented
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        self.assertEqual(self.user_profile.attachment_storage_bytes, 0)
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.PENDING_DELETE
        )

        # Restore from trash
        AttachmentTrash.toggle_statuses(
            [self.attachment.uid], active=True
        )
        self._refresh_all()

        # Counters should be restored to original values
        self.assertEqual(
            self.xform.attachment_storage_bytes, original_xform_bytes
        )
        self.assertEqual(
            self.user_profile.attachment_storage_bytes, original_user_bytes
        )
        self.assertIsNone(self.attachment.delete_status)

    def test_deleting_submission_does_not_decrease_counters_twice(self):
        """
        Test that storage counters are not decremented twice when an attachment
        is trashed and its parent submission is later deleted
        """
        # Move to trash
        AttachmentTrash.toggle_statuses([self.attachment.uid])
        self._refresh_all()
        decremented_xform_bytes = self.xform.attachment_storage_bytes
        decremented_user_bytes = self.user_profile.attachment_storage_bytes

        # Delete the submission
        view = DataViewSet.as_view({'delete': 'destroy'})
        request = self.factory.delete('/', **self.extra)
        formid = self.xform.pk
        dataid = self.xform.instances.all().order_by('id')[0].pk
        response = view(request, pk=formid, dataid=dataid)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify that the attachment storage counter is not decreased twice
        self.assertEqual(
            self.xform.attachment_storage_bytes, decremented_xform_bytes
        )
        self.assertEqual(
            self.user_profile.attachment_storage_bytes, decremented_user_bytes
        )
