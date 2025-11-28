import threading
import time
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.test import TransactionTestCase

from kpi.models.import_export_task import (
    ImportExportStatusChoices,
    SubmissionExportTask
)
from kpi.tasks import cleanup_anonymous_exports
from kpi.utils.object_permission import get_anonymous_user


class AnonymousExportCleanupTestCase(TransactionTestCase):
    def _create_export_task(
        self, status=ImportExportStatusChoices.COMPLETE, minutes_old=60
    ):
        export = SubmissionExportTask()
        export.user = get_anonymous_user()
        export.status = status
        export.data = {'type': 'xls', 'source': 'test'}
        export.save()

        if minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            SubmissionExportTask.objects.filter(uid=export.uid).update(
                date_created=past_time
            )
            export.refresh_from_db()
        return export

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

    def test_processing_exports_are_not_deleted(self):
        """
        Test that exports with PROCESSING status are never deleted
        """
        processing_export = self._create_export_task(
            status=ImportExportStatusChoices.PROCESSING,
            minutes_old=100
        )

        cleanup_anonymous_exports()
        self.assertTrue(
            SubmissionExportTask.objects.filter(
                uid=processing_export.uid
            ).exists()
        )

    def test_concurrency_locked_rows_are_skipped(self):
        exports = [self._create_export_task(minutes_old=120) for _ in range(5)]
        export_pks = [e.pk for e in exports]
        locked_pks = export_pks[:3]
        unlocked_pks = export_pks[3:]

        def lock_and_hold():
            """
            Acquire lock on first 3 exports and hold for 5 seconds,
            this will block cleanup from acquiring the lock on these rows and
            in the meantime other rows should be cleaned up
            """
            with transaction.atomic():
                # Acquire lock on first 3 exports
                list(
                    SubmissionExportTask.objects
                    .select_for_update()
                    .filter(pk__in=locked_pks)
                )

                # Hold lock for 5 seconds,
                # during this time cleanup should run
                time.sleep(5)

        # Start thread that will hold the lock
        lock_thread = threading.Thread(target=lock_and_hold, daemon=True)
        lock_thread.start()

        # Give thread time to acquire lock
        time.sleep(1)

        # Run cleanup while lock is held
        cleanup_anonymous_exports()

        # Wait for thread to finish
        lock_thread.join(timeout=10)

        # Verify locked rows were not deleted
        remaining_locked = SubmissionExportTask.objects.filter(
            pk__in=locked_pks
        ).count()
        self.assertEqual(remaining_locked, 3)

        # Verify unlocked rows were deleted
        remaining_unlocked = SubmissionExportTask.objects.filter(
            pk__in=unlocked_pks
        ).count()
        self.assertEqual(remaining_unlocked, 0)
