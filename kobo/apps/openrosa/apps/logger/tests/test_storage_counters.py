from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import RECOUNT_STORAGE_LOCK_KEY_PREFIX
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils import counters
from kobo.apps.openrosa.apps.logger.utils.attachment import (
    get_suspected_drifted_xform_ids,
    get_xform_ids_with_negative_storage,
    update_delete_status,
)
from kobo.apps.openrosa.apps.logger.utils.counters import (
    recount_storage_counter,
    update_storage_counters,
)
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


class RecountStorageCounterTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        user = User.objects.create(username='owner')
        _, self.xform, self.instance, _, self.attachment = (
            self._create_test_asset_and_submission(user=user)
        )
        self.size = self.attachment.media_file_size
        assert self.size

    def test_wrong_counter_is_fixed(self):
        self._set_counter(-999)

        assert recount_storage_counter(self.xform.pk) == (-999, self.size)

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == self.size

    def test_dry_run_reports_without_fixing(self):
        self._set_counter(-999)

        assert recount_storage_counter(self.xform.pk, dry_run=True) == (
            -999,
            self.size,
        )

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == -999

    def test_inactive_attachments_are_not_counted(self):
        Attachment.all_objects.filter(pk=self.attachment.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )

        assert recount_storage_counter(self.xform.pk) == (self.size, 0)

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == 0

    def test_bytes_added_meanwhile_are_kept(self):
        """
        Only the drift read on one snapshot is added to the counter. A file
        submitted after the sum was read, and before the counter is fixed,
        keeps the bytes its own submission added.
        """
        self._set_counter(self.size + 7)
        new_file_size = 100
        real_update_storage_counters = counters.update_storage_counters

        def submit_then_update(storage_bytes_by_xform_id):
            # A submission committed between the sum and the fix, done like
            # `create_instance()`: the file, then its bytes on the counter
            Attachment.objects.bulk_create(
                [
                    Attachment(
                        instance=self.instance,
                        xform_id=self.xform.pk,
                        user_id=self.xform.user_id,
                        media_file='owner/attachments/new_file.jpg',
                        media_file_basename='new_file.jpg',
                        media_file_size=new_file_size,
                        mimetype='image/jpeg',
                    )
                ]
            )
            real_update_storage_counters({self.xform.pk: new_file_size})
            real_update_storage_counters(storage_bytes_by_xform_id)

        with patch.object(
            counters, 'update_storage_counters', side_effect=submit_then_update
        ):
            assert recount_storage_counter(self.xform.pk) == (
                self.size + 7,
                self.size,
            )

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == self.size + new_file_size

    def test_concurrent_recount_of_the_same_project_is_skipped(self):
        self._set_counter(-999)
        lock = cache.lock(f'{RECOUNT_STORAGE_LOCK_KEY_PREFIX}{self.xform.pk}')
        assert lock.acquire(blocking=False)
        try:
            assert recount_storage_counter(self.xform.pk) is None
        finally:
            lock.release()

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == -999

    def test_unknown_project_is_skipped(self):
        assert recount_storage_counter(0) is None

    def _set_counter(self, storage_bytes: int):
        XForm.all_objects.filter(pk=self.xform.pk).update(
            attachment_storage_bytes=storage_bytes
        )


class GetSuspectedDriftedXformIdsTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        user = User.objects.create(username='owner')
        # One project per status: active only, trashed, soft deleted
        (self.active_xform, self.trashed_xform, self.soft_deleted_xform) = (
            self._create_test_asset_and_submission(user=user)[1] for _ in range(3)
        )
        Attachment.all_objects.filter(xform_id=self.trashed_xform.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )
        Attachment.all_objects.filter(xform_id=self.soft_deleted_xform.pk).update(
            delete_status=AttachmentDeleteStatus.SOFT_DELETED
        )

    def test_only_projects_with_inactive_attachments_are_suspected(self):
        assert self._get_suspected_drifted() == [self.trashed_xform.pk, self.soft_deleted_xform.pk]

    def test_walk_resumes_after_the_last_project(self):
        assert self._get_suspected_drifted(last_xform_id=self.trashed_xform.pk) == [
            self.soft_deleted_xform.pk
        ]

    @override_settings(DEFAULT_BATCH_SIZE=1)
    def test_projects_come_in_batches(self):
        assert list(get_suspected_drifted_xform_ids()) == [
            [self.trashed_xform.pk],
            [self.soft_deleted_xform.pk],
        ]

    def test_negative_counters(self):
        XForm.all_objects.filter(pk=self.active_xform.pk).update(
            attachment_storage_bytes=-5
        )

        assert get_xform_ids_with_negative_storage() == [self.active_xform.pk]

    def _get_suspected_drifted(self, **kwargs) -> list[int]:
        return [
            xform_id
            for batch in get_suspected_drifted_xform_ids(**kwargs)
            for xform_id in batch
        ]
