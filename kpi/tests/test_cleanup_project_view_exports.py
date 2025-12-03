import threading
from datetime import timedelta

from constance.test import override_config
from django.db import transaction
from django.test import TransactionTestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.import_export_task import (
    ImportExportStatusChoices,
    ProjectViewExportTask,
)
from kpi.tasks import cleanup_project_view_exports


class ProjectViewExportCleanupTestCase(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create(username='test_user')

    def _create_project_view_export(
        self,
        status=ImportExportStatusChoices.COMPLETE,
        minutes_old=60,
        processing_time_seconds=60,
    ):
        export = ProjectViewExportTask.objects.create(
            user=self.user,
            status=status,
            data={
                'type': 'assets',
                'view': 'sample_view',
                'processing_time_seconds': processing_time_seconds
            },
        )

        if minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            ProjectViewExportTask.objects.filter(uid=export.uid).update(
                date_created=past_time
            )
            export.refresh_from_db()
        return export

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_project_view_asset_exports_older_than_30_minutes_are_deleted(self):
        # Export older than 30 min - should be deleted
        old_export = self._create_project_view_export(minutes_old=31)

        # Export newer than 30 min - should be kept
        recent_export = self._create_project_view_export(minutes_old=29)

        cleanup_project_view_exports()
        self.assertFalse(
            ProjectViewExportTask.objects.filter(uid=old_export.uid).exists()
        )
        self.assertTrue(
            ProjectViewExportTask.objects.filter(uid=recent_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_processing_exports_are_not_deleted(self):
        """
        Exports marked as PROCESSING must not be deleted
        """
        processing_export = self._create_project_view_export(
            status=ImportExportStatusChoices.PROCESSING,
            minutes_old=120
        )

        cleanup_project_view_exports()
        self.assertTrue(
            ProjectViewExportTask.objects.filter(uid=processing_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_with_processing_time_deleted_correctly(self):
        """
        Exports should be deleted taking processing_time_seconds into account
        """
        old_export = self._create_project_view_export(
            minutes_old=45, processing_time_seconds=600
        )
        recent_export = self._create_project_view_export(
            minutes_old=35, processing_time_seconds=600
        )

        cleanup_project_view_exports()

        self.assertFalse(
            ProjectViewExportTask.objects.filter(uid=old_export.uid).exists()
        )
        self.assertTrue(
            ProjectViewExportTask.objects.filter(uid=recent_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_concurrency_locked_rows_are_skipped(self):
        """
        If a row is locked by another transaction, cleanup should skip it
        and still delete unlocked expired rows
        """
        exports = [self._create_project_view_export(minutes_old=120) for _ in range(5)]
        locked_export = exports[0]
        not_locked_exports = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def lock_row():
            with transaction.atomic():
                # Lock the row
                ProjectViewExportTask.objects.select_for_update().get(
                    pk=locked_export.pk
                )
                lock_acquired.set()
                release_lock.wait()

        t = threading.Thread(target=lock_row)
        t.start()

        # Wait until the lock is held
        lock_acquired.wait()

        # Now cleanup exports
        cleanup_project_view_exports()

        # Let the locking thread finish its transaction
        release_lock.set()
        t.join()

        # Verify the locked row was not deleted
        assert ProjectViewExportTask.objects.filter(pk=locked_export.pk).exists()

        # Verify unlocked rows were deleted
        assert not ProjectViewExportTask.objects.filter(
            pk__in=[e.pk for e in not_locked_exports]
        ).exists()
