from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from hub.models import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import RECOUNT_STORAGE_LOCK_KEY_PREFIX
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils import counters
from kobo.apps.openrosa.apps.logger.utils.attachment import update_delete_status
from kobo.apps.openrosa.apps.logger.utils.counters import (
    get_xform_ids_to_recount,
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

        recount = recount_storage_counter(self.xform.pk)
        assert recount == (self.xform.pk, self.xform.user_id, -999, self.size)
        assert recount.drift == self.size + 999

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == self.size

    def test_dry_run_reports_without_fixing(self):
        self._set_counter(-999)

        recount = recount_storage_counter(self.xform.pk, dry_run=True)
        assert (recount.counter, recount.real) == (-999, self.size)

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == -999

    def test_inactive_attachments_are_not_counted(self):
        Attachment.all_objects.filter(pk=self.attachment.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )

        recount = recount_storage_counter(self.xform.pk)
        assert (recount.counter, recount.real) == (self.size, 0)

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
            recount = recount_storage_counter(self.xform.pk)
            assert (recount.counter, recount.real) == (self.size + 7, self.size)

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

    def test_drift_is_not_applied_once_the_lock_expired(self):
        """
        A sum outliving the lock lets another recount take it: the first one
        must not apply its drift on top of the other's
        """
        self._set_counter(-999)
        lock_key = f'{RECOUNT_STORAGE_LOCK_KEY_PREFIX}{self.xform.pk}'
        other_lock = cache.lock(lock_key)
        real_storage_recount = counters.StorageRecount

        def expire_then_recount(*args):
            # The lock expires during the sum, and another recount takes it
            cache.delete(lock_key)
            assert other_lock.acquire(blocking=False)
            return real_storage_recount(*args)

        with patch.object(counters, 'StorageRecount', side_effect=expire_then_recount):
            try:
                assert recount_storage_counter(self.xform.pk) is None
            finally:
                other_lock.release()

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == -999

    def test_unknown_project_is_skipped(self):
        assert recount_storage_counter(0) is None

    def _set_counter(self, storage_bytes: int):
        XForm.all_objects.filter(pk=self.xform.pk).update(
            attachment_storage_bytes=storage_bytes
        )


class GetXformIdsToRecountTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        active_owner = User.objects.create(username='active_owner')
        inactive_owner = User.objects.create(username='inactive_owner')

        # Created in this order, so their ids increase in this order
        self.active_plain = self._create_test_asset_and_submission(user=active_owner)[1]
        (
            self.inactive_plain,
            self.inactive_trashed,
            self.inactive_negative,
        ) = (
            self._create_test_asset_and_submission(user=inactive_owner)[1]
            for _ in range(3)
        )
        Attachment.all_objects.filter(xform_id=self.inactive_trashed.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )
        XForm.all_objects.filter(pk=self.inactive_negative.pk).update(
            attachment_storage_bytes=-5
        )

        # No login nor project activity for years
        User.objects.filter(pk=inactive_owner.pk).update(
            date_joined=timezone.now() - timedelta(days=3 * 365), last_login=None
        )
        ExtraUserDetail.objects.filter(user_id=inactive_owner.pk).update(
            last_project_activity=None
        )

    def test_only_projects_worth_recounting_are_returned(self):
        """
        Every project of an active owner, and the projects of an inactive owner
        that hold inactive attachments or a negative counter
        """
        assert self._get_xform_ids_to_recount() == [
            self.active_plain.pk,
            self.inactive_trashed.pk,
            self.inactive_negative.pk,
        ]

    def test_walk_resumes_after_the_last_project(self):
        assert self._get_xform_ids_to_recount(last_xform_id=self.inactive_plain.pk) == [
            self.inactive_trashed.pk,
            self.inactive_negative.pk,
        ]

    @override_settings(DEFAULT_BATCH_SIZE=2)
    def test_each_batch_tells_where_to_resume(self):
        """
        A batch with nothing worth recounting still moves the cursor forward
        """
        assert list(get_xform_ids_to_recount()) == [
            (self.inactive_plain.pk, [self.active_plain.pk]),
            (
                self.inactive_negative.pk,
                [self.inactive_trashed.pk, self.inactive_negative.pk],
            ),
        ]

    def _get_xform_ids_to_recount(self, **kwargs) -> list[int]:
        return [
            xform_id
            for _, xform_ids in get_xform_ids_to_recount(**kwargs)
            for xform_id in xform_ids
        ]
