import threading
from datetime import timedelta

from constance.test import override_config
from django.test import TransactionTestCase
from django.db import transaction
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset, AssetExportSettings, SubmissionSynchronousExport
from kpi.tasks import cleanup_synchronous_exports


class SynchronousExportCleanupTestCase(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create(username='testuser')

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_synchronous_exports_older_than_30_minutes_are_deleted(self):
        # Export older than 30 min - should be deleted
        old_export = self._create_synchronous_export(
            minutes_old=31, asset=self._create_asset('Old Asset')
        )

        # Export newer than 30 min - should be kept
        recent_export = self._create_synchronous_export(
            minutes_old=29, asset=self._create_asset('Recent Asset')
        )

        cleanup_synchronous_exports()
        self.assertFalse(
            SubmissionSynchronousExport.objects.filter(uid=old_export.uid).exists()
        )
        self.assertTrue(
            SubmissionSynchronousExport.objects.filter(uid=recent_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=5)
    @override_config(SYNCHRONOUS_EXPORT_CACHE_MAX_AGE=600)
    def test_synchronous_export_cleanup_respects_cache_age(self):
        """
        Test that synchronous exports are not deleted if the grace period
        (`EXPORT_CLEANUP_GRACE_PERIOD`) is less than the synchronous export
        cache (`SYNCHRONOUS_EXPORT_CACHE_MAX_AGE`) max age
        """
        # Export older than 30 min - should be kept due to cache age
        old_export = self._create_synchronous_export(
            minutes_old=31, asset=self._create_asset('Old Asset')
        )

        cleanup_synchronous_exports()
        self.assertTrue(
            SubmissionSynchronousExport.objects.filter(uid=old_export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_processing_synchronous_exports_are_not_deleted(self):
        """
        Test that synchronous exports with PROCESSING status are never deleted
        """
        export = self._create_synchronous_export(
            status='processing', minutes_old=100, asset=self._create_asset('asset')
        )

        cleanup_synchronous_exports()
        self.assertTrue(
            SubmissionSynchronousExport.objects.filter(uid=export.uid).exists()
        )

    @override_config(EXPORT_CLEANUP_GRACE_PERIOD=30)
    def test_concurrent_cleanup_calls(self):
        """
        Test that concurrent calls to the cleanup function do not interfere
        with each other
        """
        exports = [
            self._create_synchronous_export(
                minutes_old=120,
                asset=self._create_asset(f'Asset {i}')
            ) for i in range(5)
        ]

        locked_export = exports[0]
        not_locked_exports = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def lock_row():
            with transaction.atomic():
                # Lock the row
                SubmissionSynchronousExport.objects.select_for_update().get(
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
        cleanup_synchronous_exports()

        # Let the locking thread finish its transaction
        release_lock.set()
        t.join()

        # Verify the locked row was not deleted
        assert SubmissionSynchronousExport.objects.filter(pk=locked_export.pk).exists()

        # Verify unlocked rows were deleted
        assert not SubmissionSynchronousExport.objects.filter(
            pk__in=[e.pk for e in not_locked_exports]
        ).exists()

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
            asset=asset,
            name=settings_name,
            export_settings=export_settings,
        )

    def _create_synchronous_export(self, asset, status='complete', minutes_old=60):
        export = SubmissionSynchronousExport()
        export.user = self.user
        export.status = status
        export.data = {'type': 'xls', 'source': 'test'}
        export.asset_export_settings = self._create_export_settings(asset)
        export.save()

        if minutes_old > 0:
            past_time = timezone.now() - timedelta(minutes=minutes_old)
            SubmissionSynchronousExport.objects.filter(uid=export.uid).update(
                date_created=past_time
            )
            export.refresh_from_db()
        return export
