from datetime import timedelta
from io import StringIO

import pytest
from constance.test import override_config
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.utils import timezone
from django_celery_beat.models import PeriodicTask

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.organizations.constants import UsageType
from kobo.apps.trash_bin.management.commands.restore_auto_trashed_attachments import (  # noqa: E501
    LOCK_KEY,
)
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class RestoreAutoTrashedAttachmentsTestCase(BaseTestCase, AssetSubmissionTestMixin):

    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.admin = User.objects.create(username='superadmin', is_superuser=True)
        self.asset, self.xform, self.instance, self.owner_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.owner)
        )
        self.since = (timezone.now() - timedelta(minutes=5)).isoformat()
        self.until = (timezone.now() + timedelta(minutes=5)).isoformat()
        self.owner_profile.refresh_from_db()
        self.original_storage_bytes = self.owner_profile.attachment_storage_bytes
        cache.delete(LOCK_KEY)

    def test_dry_run_does_not_restore(self):
        self._move_to_trash(self.owner)

        output = self._call_command()

        self.assertIn('1 pending trash entries', output)
        self.assertIn('for 1 user(s)', output)
        self.assertIn('Nothing has been changed', output)
        self._assert_still_in_trash()

    def test_restores_attachment_trashed_by_owner(self):
        self._move_to_trash(self.owner)
        periodic_task_id = AttachmentTrash.objects.get(
            attachment_id=self.attachment.pk
        ).periodic_task_id

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('Restored 1 attachment(s) for 1 user(s), skipped 0', output)
        self.attachment.refresh_from_db()
        self.assertIsNone(self.attachment.delete_status)
        self.assertFalse(
            AttachmentTrash.objects.filter(attachment_id=self.attachment.pk).exists()
        )
        self.assertFalse(PeriodicTask.objects.filter(pk=periodic_task_id).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                object_id=self.attachment.pk,
                user=self.admin,
                action=AuditAction.PUT_BACK,
            ).exists()
        )
        self.owner_profile.refresh_from_db()
        self.assertEqual(
            self.owner_profile.attachment_storage_bytes, self.original_storage_bytes
        )
        self.assertIsNone(cache.get(LOCK_KEY))

    def test_skips_attachment_trashed_by_someone_else(self):
        collaborator = User.objects.create(username='collaborator')
        self._move_to_trash(collaborator)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('0 restored, 1 skipped', output)
        self._assert_still_in_trash()

    def test_skips_attachment_trashed_outside_window(self):
        self._move_to_trash(self.owner)
        self.since = (timezone.now() + timedelta(minutes=1)).isoformat()

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('0 pending trash entries', output)
        self._assert_still_in_trash()

    def test_only_processes_given_users(self):
        self._move_to_trash(self.owner)

        output = self._call_command(
            '--no-dry-run', '--author', 'superadmin', '--user-id', str(self.admin.pk)
        )

        self.assertIn('0 pending trash entries', output)
        self._assert_still_in_trash()

    def test_skips_excluded_users(self):
        self._move_to_trash(self.owner)

        output = self._call_command(
            '--no-dry-run',
            '--author',
            'superadmin',
            '--exclude-user-id',
            str(self.owner.pk),
        )

        self.assertIn('0 pending trash entries', output)
        self._assert_still_in_trash()

    def test_cleans_up_trash_left_by_interrupted_run(self):
        """
        An attachment already restored on the Kobocat side keeps its trash
        entry if the run died before the KPI commit. The entry must be removed
        without counting the storage twice
        """
        self._move_to_trash(self.owner)
        AttachmentTrash.toggle_statuses([self.attachment.uid], active=True)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('1 restored, 0 skipped', output)
        self.assertFalse(
            AttachmentTrash.objects.filter(attachment_id=self.attachment.pk).exists()
        )
        self.owner_profile.refresh_from_db()
        self.assertEqual(
            self.owner_profile.attachment_storage_bytes, self.original_storage_bytes
        )

    def test_real_run_requires_superuser_author(self):
        with self.assertRaises(CommandError):
            self._call_command('--no-dry-run')

        with self.assertRaises(CommandError):
            self._call_command('--no-dry-run', '--author', 'owner')

    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_refuses_to_run_while_auto_deletion_is_enabled(self):
        with self.assertRaisesMessage(CommandError, 'AUTO_DELETE_ATTACHMENTS'):
            self._call_command('--no-dry-run', '--author', 'superadmin')

    def test_refuses_to_run_twice_at_the_same_time(self):
        self._move_to_trash(self.owner)
        cache.add(LOCK_KEY, True)
        self.addCleanup(cache.delete, LOCK_KEY)

        with self.assertRaisesMessage(CommandError, 'already in progress'):
            self._call_command('--no-dry-run', '--author', 'superadmin')

        self._assert_still_in_trash()

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_reset_storage_counters(self):
        ExceededLimitCounter = apps.get_model('stripe', 'ExceededLimitCounter')
        other = User.objects.create(username='other')
        ExceededLimitCounter.objects.create(
            user=other, limit_type=UsageType.STORAGE_BYTES, days=120
        )
        ExceededLimitCounter.objects.create(
            user=other, limit_type=UsageType.SUBMISSION, days=120
        )
        # The owner's counter was removed once back under the limit
        self._move_to_trash(self.owner)

        dry_run_output = self._call_command()
        self.assertIn(
            'Storage counters to reset: 1 (1 at 90 days or more)', dry_run_output
        )
        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=other, limit_type=UsageType.STORAGE_BYTES
            ).days,
            120,
        )

        self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=other, limit_type=UsageType.STORAGE_BYTES
            ).days,
            0,
        )
        # Other limit types are left alone
        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=other, limit_type=UsageType.SUBMISSION
            ).days,
            120,
        )
        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=self.owner, limit_type=UsageType.STORAGE_BYTES
            ).days,
            0,
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_only_resets_counters_of_given_users(self):
        ExceededLimitCounter = apps.get_model('stripe', 'ExceededLimitCounter')
        other = User.objects.create(username='other')
        ExceededLimitCounter.objects.create(
            user=other, limit_type=UsageType.STORAGE_BYTES, days=120
        )
        self._move_to_trash(self.owner)

        self._call_command(
            '--no-dry-run', '--author', 'superadmin', '--user-id', str(self.owner.pk)
        )

        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=other, limit_type=UsageType.STORAGE_BYTES
            ).days,
            120,
        )
        self.assertEqual(
            ExceededLimitCounter.objects.get(
                user=self.owner, limit_type=UsageType.STORAGE_BYTES
            ).days,
            0,
        )

    def _assert_still_in_trash(self):
        self.attachment.refresh_from_db()
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.PENDING_DELETE
        )
        self.assertTrue(
            AttachmentTrash.objects.filter(attachment_id=self.attachment.pk).exists()
        )

    def _call_command(self, *args) -> str:
        out = StringIO()
        call_command(
            'restore_auto_trashed_attachments',
            '--since',
            self.since,
            '--until',
            self.until,
            *args,
            stdout=out,
            stderr=StringIO(),
        )
        return out.getvalue()

    def _move_to_trash(self, request_author: User):
        move_to_trash(
            request_author=request_author,
            objects_list=[
                {
                    'pk': self.attachment.pk,
                    'asset_id': self.asset.pk,
                    'asset_uid': self.asset.uid,
                    'attachment_uid': self.attachment.uid,
                    'attachment_basename': self.attachment.media_file_basename,
                }
            ],
            grace_period=30,
            trash_type='attachment',
        )
