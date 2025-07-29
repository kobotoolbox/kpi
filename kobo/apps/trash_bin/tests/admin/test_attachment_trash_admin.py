from django.contrib.admin.sites import site
from django.urls import reverse
from rest_framework import status

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kobo.apps.trash_bin.admin import AttachmentTrashAdmin
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AttachmentTrashAdminTestCase(BaseTestCase, AssetSubmissionTestMixin):
    """
    Test that AttachmentTrashAdmin actions correctly delete or restore attachments
    """
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.user = User.objects.create(username='user', password='password')
        self.admin = User.objects.create_superuser(username='admin', password='admin')
        self.client.force_login(self.admin)

        # Create a new asset and submission with an attachment
        self.asset, self.xform, self.instance, self.user_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.user)
        )
        self.initial_xform_storage = self.xform.attachment_storage_bytes
        self.initial_user_storage = self.user_profile.attachment_storage_bytes

        # Move attachment to trash
        self.att_trash = self._move_attachment_to_trash(self.attachment, self.admin)

        # Admin model instance
        self.model_admin = AttachmentTrashAdmin(AttachmentTrash, site)

    def _move_attachment_to_trash(self, attachment, user):
        move_to_trash(
            request_author=user,
            objects_list=[{
                'pk': attachment.pk,
                'attachment_uid': attachment.uid,
                'attachment_basename': attachment.media_file_basename,
            }],
            grace_period=1,
            trash_type='attachment',
            retain_placeholder=False,
        )
        ParsedInstance.bulk_update_attachments([attachment.instance.pk])
        self._refresh_all()
        self._assert_storage_counters(xform_bytes=0, user_bytes=0)
        return AttachmentTrash.objects.get(attachment_id=attachment.pk)

    def _assert_storage_counters(self, xform_bytes, user_bytes):
        self.assertEqual(self.xform.attachment_storage_bytes, xform_bytes)
        self.assertEqual(self.user_profile.attachment_storage_bytes, user_bytes)

    def test_empty_trash_action_deletes_attachment(self):
        request = self.client.request().wsgi_request
        queryset = AttachmentTrash.objects.filter(pk=self.att_trash.pk)
        self.model_admin.empty_trash(request, queryset)

        self._refresh_all()
        self.assertFalse(
            AttachmentTrash.objects.filter(pk=self.att_trash.pk).exists()
        )
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.DELETED
        )

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='logger',
            model_name='attachment',
            object_id=self.attachment.pk,
            user=self.admin,
            action=AuditAction.DELETE,
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
            metadata={
                'attachment_uid': self.attachment.uid,
                'attachment_name': self.attachment.media_file_basename,
                'instance__root_uuid': self.attachment.instance.root_uuid,
            },
        ).exists()

    def test_put_back_action_restores_attachment(self):
        request = self.client.request().wsgi_request
        queryset = AttachmentTrash.objects.filter(pk=self.att_trash.pk)
        self.model_admin.put_back(request, queryset)

        self._refresh_all()
        self.assertFalse(
            AttachmentTrash.objects.filter(pk=self.att_trash.pk).exists()
        )
        self.assertEqual(self.attachment.delete_status, None)
        self._assert_storage_counters(
            xform_bytes=self.initial_xform_storage,
            user_bytes=self.initial_user_storage,
        )

        # Ensure action is logged
        assert AuditLog.objects.filter(
            app_label='logger',
            model_name='attachment',
            object_id=self.attachment.pk,
            user=self.admin,
            action=AuditAction.PUT_BACK,
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
        ).exists()

    def test_put_back_action_updates_is_deleted_flag(self):
        """
        Test that the `put_back` action updates the `is_deleted` flag of the
        attachment to `False` in mongoDB
        """
        submission_detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.instance.pk,
            },
        )
        response = self.client.get(submission_detail_url)
        assert response.status_code == status.HTTP_200_OK

        for attachment in response.data['_attachments']:
            assert attachment['is_deleted'] is True

        # Put back the attachment
        request = self.client.request().wsgi_request
        queryset = AttachmentTrash.objects.filter(pk=self.att_trash.pk)
        self.model_admin.put_back(request, queryset)

        # Hit the endpoint again to check if the `is_deleted` flag is updated
        updated_response = self.client.get(submission_detail_url)
        assert updated_response.status_code == status.HTTP_200_OK

        for attachment in updated_response.data['_attachments']:
            assert attachment['is_deleted'] is False

    def _refresh_all(self):
        """
        Refresh all test objects from the database to get updated values
        """
        self.asset.refresh_from_db()
        self.instance.refresh_from_db()
        self.xform.refresh_from_db()
        self.user_profile.refresh_from_db()
        self.attachment.refresh_from_db()
