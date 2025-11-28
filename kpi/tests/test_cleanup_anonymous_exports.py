from datetime import timedelta

from django.utils import timezone
from django.test import TestCase

from kpi.models.import_export_task import (
    ImportExportStatusChoices,
    SubmissionExportTask
)
from kpi.tasks import cleanup_anonymous_exports
from kpi.utils.object_permission import get_anonymous_user


class AnonymousExportCleanupTestCase(TestCase):
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
