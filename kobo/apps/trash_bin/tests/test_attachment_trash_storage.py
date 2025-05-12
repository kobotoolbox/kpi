from rest_framework import status

from kobo.apps.openrosa.apps.api.viewsets.data_viewset import DataViewSet
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.trash_bin.models.attachment import AttachmentTrash


class AttachmentTrashStorageCountersTestCase(TestBase):
    """
    Test that moving an attachment to trash and restoring it updates the
    storage counters
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

        # Change the status to simulate moving to trash
        AttachmentTrash.toggle_statuses([self.attachment.uid])
        self._refresh_all()

        # Counters should be decremented
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        self.assertEqual(self.user_profile.attachment_storage_bytes, 0)
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.PENDING_DELETE
        )

        # Change the status to simulate the restoration from trash
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
        # Change the status to simulate moving to trash
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
