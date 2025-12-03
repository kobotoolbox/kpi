import threading
from datetime import timedelta

from constance.test import override_config
from ddt import ddt, data, unpack
from django.db import transaction
from django.test import TransactionTestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset, AssetExportSettings
from kpi.models.import_export_task import (
    ImportExportStatusChoices,
    SubmissionExportTask,
    SubmissionSynchronousExport,
)
from kpi.tasks import cleanup_anonymous_exports, cleanup_synchronous_exports
from kpi.utils.object_permission import get_anonymous_user


@ddt
class AnonymousAndSynchronousExportCleanupTestCase(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create(username='test_user')

    @data(
        (SubmissionExportTask, cleanup_anonymous_exports),
        (SubmissionSynchronousExport, cleanup_synchronous_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_older_than_30_minutes_are_deleted(self, model, cleanup_task):
        old_export = self._create_export(model=model, minutes_old=31)
        recent_export = self._create_export(model=model, minutes_old=29)

        cleanup_task()

        self.assertFalse(model.objects.filter(pk=old_export.pk).exists())
        self.assertTrue(model.objects.filter(pk=recent_export.pk).exists())

    @data(
        (SubmissionExportTask, cleanup_anonymous_exports),
        (SubmissionSynchronousExport, cleanup_synchronous_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_processing_exports_are_not_deleted(self, model, cleanup_task):
        processing_export = self._create_export(
            model=model,
            status=ImportExportStatusChoices.PROCESSING,
            minutes_old=120,
        )

        cleanup_task()
        self.assertTrue(model.objects.filter(pk=processing_export.pk).exists())

    @data(
        (SubmissionExportTask, cleanup_anonymous_exports),
        (SubmissionSynchronousExport, cleanup_synchronous_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_exports_with_processing_time_deleted_correctly(self, model, cleanup_task):
        old_export = self._create_export(
            model=model, minutes_old=45, processing_time_seconds=600
        )
        recent_export = self._create_export(
            model=model, minutes_old=35, processing_time_seconds=600
        )

        cleanup_task()

        self.assertFalse(model.objects.filter(pk=old_export.pk).exists())
        self.assertTrue(model.objects.filter(pk=recent_export.pk).exists())

    @data(
        (SubmissionExportTask, cleanup_anonymous_exports),
        (SubmissionSynchronousExport, cleanup_synchronous_exports),
    )
    @unpack
    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_concurrency_locked_rows_are_skipped(self, model, cleanup_task):
        exports = [self._create_export(model=model, minutes_old=120) for _ in range(5)]
        locked_export = exports[0]
        not_locked = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def lock_row():
            with transaction.atomic():
                model.objects.select_for_update().get(pk=locked_export.pk)
                lock_acquired.set()
                release_lock.wait()

        t = threading.Thread(target=lock_row)
        t.start()

        # Wait for the row-level lock to actually be acquired
        lock_acquired.wait()

        cleanup_task()

        # Let the locking thread finish its transaction
        release_lock.set()
        t.join()

        # Verify the locked row was not deleted
        self.assertTrue(model.objects.filter(pk=locked_export.pk).exists())

        # Verify unlocked rows were deleted
        self.assertFalse(
            model.objects.filter(pk__in=[e.pk for e in not_locked]).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=5)
    @override_config(SYNCHRONOUS_EXPORT_CACHE_MAX_AGE=600)
    def test_synchronous_export_cleanup_respects_cache_age(self):
        """
        If EXPORT_CLEANUP_GRACE_PERIOD * 60 < SYNCHRONOUS_EXPORT_CACHE_MAX_AGE,
        cleanup should be skipped for synchronous exports.
        """
        old_export = self._create_export(
            model=SubmissionSynchronousExport,
            minutes_old=31,
        )

        cleanup_synchronous_exports()
        self.assertTrue(
            SubmissionSynchronousExport.objects.filter(pk=old_export.pk).exists()
        )

    def _create_asset(self, name):
        asset = Asset.objects.create(
            owner=self.user, asset_type=ASSET_TYPE_SURVEY, name=name
        )
        asset.deploy(backend='mock', active=True)
        asset.save()
        return asset

    def _create_export_settings(self, asset):
        settings_name = 'Simple XLS export'
        export_settings = {
            'fields_from_all_versions': 'true',
            'group_sep': '/',
            'hierarchy_in_labels': 'true',
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'xls',
        }
        return AssetExportSettings.objects.create(
            asset=asset, name=settings_name, export_settings=export_settings
        )

    def _create_export(
        self,
        model,
        status=ImportExportStatusChoices.COMPLETE,
        minutes_old=60,
        processing_time_seconds=60,
    ):
        """
        Create and return an export of the given model type
        """
        if model is SubmissionExportTask:
            export = SubmissionExportTask()
            export.user = get_anonymous_user()
            export.status = status
            export.data = {
                'type': 'xls',
                'source': 'test',
                'processing_time_seconds': processing_time_seconds,
            }
            export.save()
        elif model is SubmissionSynchronousExport:
            asset = self._create_asset('Asset for sync export')
            export_settings = self._create_export_settings(asset)
            export = SubmissionSynchronousExport()
            export.user = self.user
            export.status = status
            export.data = {
                'type': 'xls',
                'source': 'test',
                'processing_time_seconds': processing_time_seconds
            }
            export.asset_export_settings = export_settings
            export.save()
        else:
            raise AssertionError(f'Unsupported model: {model}')

        if minutes_old and minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            model.objects.filter(pk=export.pk).update(date_created=past_time)
            export.refresh_from_db()

        return export
