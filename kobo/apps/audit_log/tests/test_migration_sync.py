from importlib import import_module
from django.test import TestCase

from kobo.apps.audit_log.models import AuditLog, AuditType, AuditAction
from kobo.apps.kobo_auth.shortcuts import User

job = import_module('kobo.apps.long_running_migrations.jobs.0020_sync_auditlog_object_id')  # noqa


class AuditLogMigrationSyncTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', email='testuser@example.com', password='password'
        )

    def test_standard_save_populates_tmp_field(self):
        """
        Test that the `object_id_tmp` field is correctly populated when saving an
        AuditLog instance using the standard `save()` method
        """
        log = AuditLog.objects.create(
            user=self.user,
            app_label='kpi',
            model_name='asset',
            object_id=12345,
            action=AuditAction.CREATE,
            log_type=AuditType.PROJECT_HISTORY
        )
        log = AuditLog.objects.get(pk=log.pk)
        self.assertEqual(log.object_id_tmp, '12345')

    def test_update_fields_save_populates_tmp_field(self):
        """
        Test that the `object_id_tmp` field is correctly populated when updating an
        AuditLog instance using `save(update_fields=...)`
        """
        log = AuditLog.objects.create(
            user=self.user,
            app_label='kpi',
            model_name='asset',
            object_id=123,
            action=AuditAction.CREATE,
            log_type=AuditType.PROJECT_HISTORY
        )
        AuditLog.objects.filter(pk=log.pk).update(object_id_tmp=None)
        log.refresh_from_db()
        log.action = AuditAction.UPDATE
        log.save(update_fields=['action'])

        log = AuditLog.objects.get(pk=log.pk)
        self.assertEqual(log.object_id_tmp, '123')

    def test_bulk_create_populates_tmp_field(self):
        """
        Test `object_id_tmp` is populated for `bulk_create` operations, which bypass
        the `save()` method and its associated logic
        """
        logs = [
            AuditLog(
                user=self.user,
                app_label='kpi',
                model_name='asset',
                object_id=i,
                object_id_tmp=str(i),
                action=AuditAction.CREATE,
                log_type=AuditType.PROJECT_HISTORY
            ) for i in range(5)
        ]
        AuditLog.objects.bulk_create(logs)

        for log in AuditLog.objects.filter(pk__in=[log.pk for log in logs]):
            self.assertEqual(log.object_id_tmp, str(log.object_id))

    def test_migration_sync_populates_tmp_field(self):
        """
        Test that the long-running migration correctly populates the `object_id_tmp`
        field for existing logs
        """
        log = AuditLog.objects.create(
            user=self.user,
            app_label='kpi',
            model_name='asset',
            object_id=54321,
            action=AuditAction.CREATE,
            log_type=AuditType.PROJECT_HISTORY,
        )

        job.run()
        self.assertEqual(AuditLog.objects.get(pk=log.pk).object_id_tmp, '54321')
