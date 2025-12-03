import threading
from datetime import timedelta

from constance.test import override_config
from ddt import data, ddt, unpack
from django.db import transaction
from django.test import TransactionTestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ImportExportStatusChoices,
    ProjectHistoryLogExportTask,
)
from kpi.tasks import cleanup_access_log_exports, cleanup_project_history_log_exports


@ddt
class AuditLogExportCleanupTestCase(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create(username='test_user')

    @data(
        (AccessLogExportTask, cleanup_access_log_exports),
        (ProjectHistoryLogExportTask, cleanup_project_history_log_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_older_than_30_minutes_are_deleted(self, model, cleanup_task):
        old_export = self._create_export(model=model, minutes_old=31)
        recent_export = self._create_export(model=model, minutes_old=29)

        cleanup_task()

        self.assertFalse(
            model.objects.filter(pk=old_export.pk).exists()
        )
        self.assertTrue(
            model.objects.filter(pk=recent_export.pk).exists()
        )

    @data(
        (AccessLogExportTask, cleanup_access_log_exports),
        (ProjectHistoryLogExportTask, cleanup_project_history_log_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_processing_exports_are_not_deleted(self, model, cleanup_task):
        """
        Exports marked as PROCESSING must not be deleted
        """
        processing_export = self._create_export(
            model=model,
            status=ImportExportStatusChoices.PROCESSING,
            minutes_old=120
        )

        cleanup_task()
        self.assertTrue(
            model.objects.filter(pk=processing_export.pk).exists()
        )

    @data(
        (AccessLogExportTask, cleanup_access_log_exports),
        (ProjectHistoryLogExportTask, cleanup_project_history_log_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_with_processing_time_deleted_correctly(self, model, cleanup_task):
        """
        Exports should be deleted taking processing_time_seconds into account
        """
        old_export = self._create_export(
            model=model,
            minutes_old=45, processing_time_seconds=600
        )
        recent_export = self._create_export(
            model=model,
            minutes_old=35, processing_time_seconds=600
        )

        cleanup_task()
        self.assertFalse(
            model.objects.filter(pk=old_export.pk).exists()
        )
        self.assertTrue(
            model.objects.filter(pk=recent_export.pk).exists()
        )

    @data(
        (AccessLogExportTask, cleanup_access_log_exports),
        (ProjectHistoryLogExportTask, cleanup_project_history_log_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_concurrency_locked_rows_are_skipped(self, model, cleanup_task):
        """
        If a row is locked by another transaction, cleanup should skip it
        and still delete unlocked expired rows.
        """
        exports = [self._create_export(minutes_old=120, model=model) for _ in range(5)]
        locked_export = exports[0]
        not_locked = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def lock_row():
            with transaction.atomic():
                # acquire row lock and hold until released
                model.objects.select_for_update().get(
                    pk=locked_export.pk
                )
                lock_acquired.set()
                release_lock.wait()

        t = threading.Thread(target=lock_row)
        t.start()

        # wait until lock is held
        lock_acquired.wait()

        # should skip locked row and delete other expired rows
        cleanup_task()

        # release and join
        release_lock.set()
        t.join()

        # locked row should still exist
        self.assertTrue(model.objects.filter(pk=locked_export.pk).exists())

        # others should be deleted
        self.assertFalse(
            model.objects.filter(pk__in=[e.pk for e in not_locked]).exists()
        )

    def _create_export(
        self,
        model,
        status=ImportExportStatusChoices.COMPLETE,
        minutes_old=60,
        processing_time_seconds=60,
    ):
        export = model.objects.create(
            user=self.user,
            status=status,
            data={
                'type': f'{model.__name__}_export',
                'processing_time_seconds': processing_time_seconds
            },
        )

        if minutes_old is not None and minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            model.objects.filter(pk=export.pk).update(
                date_created=past_time
            )
            export.refresh_from_db()
        return export
