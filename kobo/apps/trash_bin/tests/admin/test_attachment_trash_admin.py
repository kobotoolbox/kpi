from django.contrib.admin.sites import site
from django.contrib.auth import get_user_model

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.trash_bin.admin import AttachmentTrashAdmin
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash


class AttachmentTrashAdminTestCase(TestBase):
    """
    Test that AttachmentTrashAdmin actions correctly delete or restore attachments
    """
    def setUp(self):
        super().setUp()
        self._create_user_and_login()
        self._publish_transportation_form()
        self._submit_transport_instance_w_attachment()
        self.attachment = Attachment.objects.last()

        # Get the initial storage counters
        self.xform.refresh_from_db()
        self.user_profile = UserProfile.objects.get(user=self.xform.user)
        self.initial_xform_storage = self.xform.attachment_storage_bytes
        self.initial_user_storage = self.user_profile.attachment_storage_bytes

        # Create superuser for admin actions
        self.admin = get_user_model().objects.create_user(
            username='admin', password='admin', is_superuser=True, is_staff=True
        )
        self.client.login(username='admin', password='admin')

        # Move attachment to trash
        self.att_trash = self._move_attachment_to_trash(self.attachment, self.admin)

        # Admin model instance
        self.model_admin = AttachmentTrashAdmin(AttachmentTrash, site)

    def _move_attachment_to_trash(self, attachment, user):
        AttachmentTrash.toggle_statuses([attachment.uid])
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
        attachment.refresh_from_db()
        self._assert_storage_counters(xform_bytes=0, user_bytes=0)
        return AttachmentTrash.objects.get(attachment_id=attachment.pk)

    def _assert_storage_counters(self, xform_bytes, user_bytes):
        self.xform.refresh_from_db()
        self.user_profile.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, xform_bytes)
        self.assertEqual(self.user_profile.attachment_storage_bytes, user_bytes)

    def test_empty_trash_action_deletes_attachment(self):
        self.xform.refresh_from_db()
        request = self.client.request().wsgi_request
        queryset = AttachmentTrash.objects.filter(pk=self.att_trash.pk)
        self.model_admin.empty_trash(request, queryset)

        self.xform.refresh_from_db()
        self.attachment.refresh_from_db()
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

        self.attachment.refresh_from_db()
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
