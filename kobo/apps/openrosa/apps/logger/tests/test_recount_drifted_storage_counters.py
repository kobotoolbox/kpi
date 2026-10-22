from unittest.mock import patch

from celery.exceptions import SoftTimeLimitExceeded
from django.core.cache import cache
from django.db import OperationalError
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    RECOUNT_STORAGE_ROTATION_CURSOR_KEY,
    RECOUNT_STORAGE_ROTATION_LOCK_KEY,
)
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.tasks import recount_drifted_storage_counters
from kobo.apps.openrosa.apps.logger.utils import counters
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class RecountDriftedStorageCountersTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        cache.delete(RECOUNT_STORAGE_ROTATION_CURSOR_KEY)
        user = User.objects.create(username='owner')
        drifted, accurate, negative = (
            self._create_test_asset_and_submission(user=user)[1] for _ in range(3)
        )
        self.size = drifted.attachment_storage_bytes
        assert self.size

        # Suspect, and too high: its attachment was trashed without its size
        # being subtracted
        Attachment.all_objects.filter(xform_id=drifted.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )
        # Suspect, but accurate
        Attachment.all_objects.filter(xform_id=accurate.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )
        XForm.all_objects.filter(pk=accurate.pk).update(attachment_storage_bytes=0)
        # Not suspect, but negative
        XForm.all_objects.filter(pk=negative.pk).update(attachment_storage_bytes=-5)

        self.drifted, self.accurate, self.negative = drifted, accurate, negative

    def tearDown(self):
        cache.delete(RECOUNT_STORAGE_ROTATION_CURSOR_KEY)

    def test_drifted_counters_are_fixed(self):
        recount_drifted_storage_counters()

        assert self._counters() == (0, 0, self.size)
        # The turn is completed, the next run starts over
        assert cache.get(RECOUNT_STORAGE_ROTATION_CURSOR_KEY) is None

    def test_run_resumes_after_the_last_project_recounted(self):
        cache.set(RECOUNT_STORAGE_ROTATION_CURSOR_KEY, self.drifted.pk, timeout=None)

        recount_drifted_storage_counters()

        # The drifted project comes before the cursor, so it waits for the next
        # turn
        assert self._counters() == (self.size, 0, self.size)

    def test_run_stops_at_its_soft_time_limit(self):
        """
        Celery raises `SoftTimeLimitExceeded` in the middle of the run: the
        projects recounted so far stay fixed, the cursor points to the last of
        them, and the lock is released for the next run
        """
        real_recount = counters.recount_storage_counter

        def stop_after_first_project(xform_id):
            if xform_id != self.drifted.pk:
                raise SoftTimeLimitExceeded()
            return real_recount(xform_id)

        with patch.object(
            counters, 'recount_storage_counter', side_effect=stop_after_first_project
        ):
            recount_drifted_storage_counters()

        assert self._counters() == (0, 0, -5)
        assert cache.get(RECOUNT_STORAGE_ROTATION_CURSOR_KEY) == self.drifted.pk
        lock = cache.lock(RECOUNT_STORAGE_ROTATION_LOCK_KEY)
        assert lock.acquire(blocking=False)
        lock.release()

    def test_run_does_nothing_while_another_one_runs(self):
        lock = cache.lock(RECOUNT_STORAGE_ROTATION_LOCK_KEY)
        assert lock.acquire(blocking=False)
        try:
            recount_drifted_storage_counters()
        finally:
            lock.release()

        assert self._counters() == (self.size, 0, -5)

    def test_failed_recount_does_not_stop_the_turn(self):
        real_recount = counters.recount_storage_counter

        def fail_on_drifted(xform_id):
            if xform_id == self.drifted.pk:
                raise OperationalError('canceling statement due to statement timeout')
            return real_recount(xform_id)

        with patch.object(
            counters, 'recount_storage_counter', side_effect=fail_on_drifted
        ):
            recount_drifted_storage_counters()

        assert self._counters() == (self.size, 0, self.size)
        assert cache.get(RECOUNT_STORAGE_ROTATION_CURSOR_KEY) is None

    def _counters(self) -> tuple[int, int, int]:
        storage_by_xform_id = dict(
            XForm.all_objects.filter(
                pk__in=[self.drifted.pk, self.accurate.pk, self.negative.pk]
            ).values_list('pk', 'attachment_storage_bytes')
        )
        return (
            storage_by_xform_id[self.drifted.pk],
            storage_by_xform_id[self.accurate.pk],
            storage_by_xform_id[self.negative.pk],
        )
