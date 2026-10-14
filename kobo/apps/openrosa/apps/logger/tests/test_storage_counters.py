from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils.attachment import update_delete_status
from kobo.apps.openrosa.apps.logger.utils.counters import update_storage_counters
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class UpdateDeleteStatusTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        self.user = User.objects.create(username='owner')
        _, self.xform, _, _, self.attachment = self._create_test_asset_and_submission(
            user=self.user
        )
        self.size = self.attachment.media_file_size
        assert self.size

    def test_leaving_active_status_subtracts_storage(self):
        updated, storage_bytes_by_xform_id = update_delete_status(
            [self.attachment.uid],
            from_status=None,
            to_status=AttachmentDeleteStatus.PENDING_DELETE,
        )

        assert updated == 1
        assert storage_bytes_by_xform_id == {self.xform.pk: -self.size}

    def test_coming_back_to_active_status_adds_storage(self):
        self._set_delete_status(AttachmentDeleteStatus.SOFT_DELETED)

        updated, storage_bytes_by_xform_id = update_delete_status(
            [self.attachment.uid],
            from_status=AttachmentDeleteStatus.SOFT_DELETED,
            to_status=None,
            deleted_at=None,
        )

        assert updated == 1
        assert storage_bytes_by_xform_id == {self.xform.pk: self.size}
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status is None

    def test_moving_between_inactive_statuses_does_not_change_storage(self):
        self._set_delete_status(AttachmentDeleteStatus.PENDING_DELETE)

        updated, storage_bytes_by_xform_id = update_delete_status(
            [self.attachment.uid],
            from_status=AttachmentDeleteStatus.PENDING_DELETE,
            to_status=AttachmentDeleteStatus.DELETED,
        )

        assert updated == 1
        assert storage_bytes_by_xform_id == {}

    def test_attachment_already_moved_is_not_counted(self):
        """
        An attachment already in the target status, e.g. trashed a moment
        earlier by another request, matches no row and must not be counted
        """
        update_delete_status(
            [self.attachment.uid],
            from_status=None,
            to_status=AttachmentDeleteStatus.PENDING_DELETE,
        )

        updated, storage_bytes_by_xform_id = update_delete_status(
            [self.attachment.uid],
            from_status=None,
            to_status=AttachmentDeleteStatus.PENDING_DELETE,
        )

        assert updated == 0
        assert storage_bytes_by_xform_id == {}

    def _set_delete_status(self, delete_status: AttachmentDeleteStatus):
        Attachment.all_objects.filter(pk=self.attachment.pk).update(
            delete_status=delete_status
        )


class UpdateStorageCountersTestCase(TestCase, AssetSubmissionTestMixin):

    def test_each_project_gets_its_own_bytes(self):
        user = User.objects.create(username='owner')
        _, xform_1, *_ = self._create_test_asset_and_submission(user=user)
        _, xform_2, *_ = self._create_test_asset_and_submission(user=user)
        storage_1 = xform_1.attachment_storage_bytes
        storage_2 = xform_2.attachment_storage_bytes

        update_storage_counters({xform_2.pk: -10, xform_1.pk: 25})

        xform_1.refresh_from_db()
        xform_2.refresh_from_db()
        assert xform_1.attachment_storage_bytes == storage_1 + 25
        assert xform_2.attachment_storage_bytes == storage_2 - 10

    def test_trashed_project_is_updated_too(self):
        user = User.objects.create(username='owner')
        _, xform, *_ = self._create_test_asset_and_submission(user=user)
        storage = xform.attachment_storage_bytes
        XForm.all_objects.filter(pk=xform.pk).update(pending_delete=True)

        update_storage_counters({xform.pk: -storage})

        xform.refresh_from_db()
        assert xform.attachment_storage_bytes == 0

    def test_zero_bytes_runs_no_query(self):
        with self.assertNumQueries(0):
            update_storage_counters({1: 0})
