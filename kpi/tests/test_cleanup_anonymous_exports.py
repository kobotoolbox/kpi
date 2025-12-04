import threading
from datetime import timedelta

from constance.test import override_config
from django.db import transaction
from django.test import TransactionTestCase
from django.utils import timezone

from kpi.models.import_export_task import (
    ImportExportStatusChoices,
    SubmissionExportTask,
)
from kpi.tasks import cleanup_anonymous_exports
from kpi.utils.object_permission import get_anonymous_user


class AnonymousExportCleanupTestCase(TransactionTestCase):
    def _create_export_task(
        self,
        status=ImportExportStatusChoices.COMPLETE,
        minutes_old=60,
        processing_time_seconds=60
    ):
        export = SubmissionExportTask()
        export.user = get_anonymous_user()
        export.status = status
        export.data = {
            'type': 'xls',
            'source': 'test',
            'processing_time_seconds': processing_time_seconds
        }
        export.save()

        if minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            SubmissionExportTask.objects.filter(uid=export.uid).update(
                date_created=past_time
            )
            export.refresh_from_db()
        return export

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_older_than_30_minutes_are_deleted(self):
        # Export older than 30 min - should be deleted
        old_export = self._create_export_task(minutes_old=31)

        # Export newer than 30 min - should be kept
        recent_export = self._create_export_task(minutes_old=29)

        cleanup_anonymous_exports()
        self.assertFalse(
            SubmissionExportTask.objects.filter(uid=old_export.uid).exists()
        )
        self.assertTrue(
            SubmissionExportTask.objects.filter(uid=recent_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_with_processing_time_deleted_correctly(self):
        """
        Test that exports are deleted correctly considering their processing time
        """
        # Export created 45 min ago, processing took 10 min
        old_export = self._create_export_task(
            minutes_old=45,
            processing_time_seconds=600,
        )

        # Export created 35 min ago, processing took 10 min
        recent_export = self._create_export_task(
            minutes_old=35,
            processing_time_seconds=600,
        )

        cleanup_anonymous_exports()

        # Old export should be deleted
        self.assertFalse(
            SubmissionExportTask.objects.filter(uid=old_export.uid).exists()
        )

        # Recent export should be kept
        self.assertTrue(
            SubmissionExportTask.objects.filter(uid=recent_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_processing_exports_are_not_deleted(self):
        """
        Test that exports with PROCESSING status are never deleted
        """
        processing_export = self._create_export_task(
            status=ImportExportStatusChoices.PROCESSING, minutes_old=100
        )

        cleanup_anonymous_exports()
        self.assertTrue(
            SubmissionExportTask.objects.filter(uid=processing_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_concurrency_locked_rows_are_skipped(self):
        exports = [self._create_export_task(minutes_old=120) for _ in range(5)]
        locked_export = exports[0]
        not_locked_exports = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def lock_row():
            with transaction.atomic():
                # Lock the row
                SubmissionExportTask.objects.select_for_update().get(
                    pk=locked_export.pk
                )

                # Signal that the lock is active
                lock_acquired.set()

                # Wait until the main thread signals we can release the lock
                release_lock.wait()

        t = threading.Thread(target=lock_row)
        t.start()

        # Wait for the row-level lock to actually be acquired
        lock_acquired.wait()

        # Now cleanup should try select_for_update(nowait=True), causing DatabaseError
        cleanup_anonymous_exports()

        # Let the locking thread finish its transaction
        release_lock.set()
        t.join()

        # Verify the locked row was not deleted
        assert SubmissionExportTask.objects.filter(pk=locked_export.pk).exists()

        # Verify unlocked rows were deleted
        assert not SubmissionExportTask.objects.filter(
            pk__in=[e.pk for e in not_locked_exports]
        ).exists()
