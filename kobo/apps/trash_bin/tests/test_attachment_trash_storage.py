import uuid

from constance.test import override_config
from django.test import TestCase
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.api.viewsets.data_viewset import DataViewSet
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.project_ownership.utils import create_invite
from kobo.apps.trash_bin.utils import move_to_trash, put_back
from kpi.models import Asset
from kpi.tests.utils.transaction import immediate_on_commit


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

        # Move the attachment to trash
        self._move_to_trash()

        # Counters should be decremented
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        self.assertEqual(self.user_profile.attachment_storage_bytes, 0)
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.PENDING_DELETE
        )

        # Restore the attachment
        self._put_back_from_trash()

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
        # Move the attachment to trash
        self._move_to_trash()
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

    def _move_to_trash(self):
        """
        Move the attachment to trash and refresh all objects
        """
        move_to_trash(
            request_author=self.user,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            grace_period=1,
            trash_type='attachment',
            retain_placeholder=False,
        )
        self._refresh_all()

    def _put_back_from_trash(self):
        """
        Restore the attachment from trash and refresh all objects
        """
        put_back(
            request_author=self.user,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            trash_type='attachment',
        )
        self._refresh_all()

    def _refresh_all(self):
        """
        Refresh all relevant objects from the database to get updated values.
        """
        self.attachment.refresh_from_db()
        self.xform.refresh_from_db()
        self.user_profile.refresh_from_db()


class TransferredProjectAttachmentTrashCounterTestCase(TestCase):
    """
    Tests that attachment counters update correctly when a transferred project's
    attachments are trashed and restored.
    """
    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.new_owner = User.objects.create(username='new_owner')
        self.owner_profile = UserProfile.objects.create(user=self.owner)
        self.new_owner_profile = UserProfile.objects.create(user=self.new_owner)

    def test_counters_are_updated_when_attachments_are_trashed_after_transfer(self):
        self._create_asset_and_submission()

        # Initial state: attachment belongs to original owner
        xform_storage_init = self.xform.attachment_storage_bytes
        owner_storage_init = self.owner_profile.attachment_storage_bytes
        new_owner_storage_init = self.new_owner_profile.attachment_storage_bytes

        self.assertGreater(xform_storage_init, 0)
        self.assertGreater(owner_storage_init, 0)
        self.assertEqual(new_owner_storage_init, 0)

        # 1. Transfer the project to another user
        self._transfer_project()

        self._refresh_all()
        xform_storage_after_transfer = self.xform.attachment_storage_bytes
        owner_storage_after_transfer = self.owner_profile.attachment_storage_bytes
        new_owner_storage_after_transfer = (
            self.new_owner_profile.attachment_storage_bytes
        )

        self.assertGreater(xform_storage_after_transfer, 0)
        self.assertEqual(owner_storage_after_transfer, 0)
        self.assertGreater(new_owner_storage_after_transfer, 0)
        self.assertEqual(new_owner_storage_after_transfer, owner_storage_init)

        # 2. Move the attachments to trash
        move_to_trash(
            request_author=self.new_owner,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            grace_period=1,
            trash_type='attachment',
            retain_placeholder=False,
        )
        self._refresh_all()

        xform_storage_after_trash = self.xform.attachment_storage_bytes
        owner_storage_after_trash = self.owner_profile.attachment_storage_bytes
        new_owner_storage_after_trash = self.new_owner_profile.attachment_storage_bytes

        # After trash: all counters should be 0
        self.assertEqual(xform_storage_after_trash, 0)
        self.assertEqual(owner_storage_after_trash, 0)
        self.assertEqual(new_owner_storage_after_trash, 0)

        # 3. Restore the attachments from trash
        put_back(
            request_author=self.new_owner,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            trash_type='attachment',
        )
        self._refresh_all()

        xform_storage_after_restore = self.xform.attachment_storage_bytes
        owner_storage_after_restore = self.owner_profile.attachment_storage_bytes
        new_owner_storage_after_restore = (
            self.new_owner_profile.attachment_storage_bytes
        )

        # After restore: values should match post-transfer values
        self.assertEqual(xform_storage_after_restore, xform_storage_after_transfer)
        self.assertEqual(owner_storage_after_restore, 0)
        self.assertEqual(
            new_owner_storage_after_restore, new_owner_storage_after_transfer
        )

    def _create_asset_and_submission(self):
        """
        Helper method to create an asset and its associated submission
        with attachments
        """
        self.asset = Asset.objects.create(
            asset_type='survey',
            content={
                'survey': [
                    {'type': 'audio', 'label': 'q1', 'name': 'q1'},
                ]
            },
            owner=self.owner
        )
        self.asset.save()
        self.asset.deploy(backend='mock')

        username = self.owner.username
        submission = {
            'q1': 'audio_conversion_test_clip.3gp',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'download_url': f'http://testserver/{username}/audio_conversion_test_clip.3gp',  # noqa: E501
                    'filename': f'{username}/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                },
            ],
            '_submitted_by': username,
        }
        self.asset.deployment.mock_submissions([submission])
        self.xform = self.asset.deployment.xform
        self.attachment = self.xform.attachments.first()
        self._refresh_all()

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def _transfer_project(self):
        """
        Helper method to transfer the project to another user
        """
        with immediate_on_commit():
            create_invite(
                self.owner,
                self.new_owner,
                [self.asset],
                'Invite'
            )
        self._refresh_all()
        assert self.asset.owner == self.new_owner

    def _refresh_all(self):
        """
        Refresh all test objects from the database to get updated values
        """
        self.asset.refresh_from_db()
        self.xform.refresh_from_db()
        self.owner_profile.refresh_from_db()
        self.new_owner_profile.refresh_from_db()
