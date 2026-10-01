from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from constance.test import override_config
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import override_settings
from django.utils import timezone
from django_celery_beat.models import PeriodicTask

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.organizations.constants import UsageType
from kobo.apps.trash_bin.management.commands.restore_auto_trashed_attachments import (  # noqa: E501
    LOCK_KEY,
    PENDING_MONGO_KEY,
    Command,
)
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


# The lock and the saved positions live in the cache. A local cache keeps
# parallel test workers from sharing them through Redis
@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
)
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
        cache.delete(PENDING_MONGO_KEY)

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

        self.assertIn(
            'Restored 1 attachment(s) for 1 user(s), kept 0, skipped 0', output
        )
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

        self.assertIn('0 restored, 0 kept (trashed by the owner), 1 skipped', output)
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

        self.assertIn('1 restored, 0 kept (trashed by the owner), 0 skipped', output)
        self.assertFalse(
            AttachmentTrash.objects.filter(attachment_id=self.attachment.pk).exists()
        )
        self.owner_profile.refresh_from_db()
        self.assertEqual(
            self.owner_profile.attachment_storage_bytes, self.original_storage_bytes
        )

    def test_keeps_newer_attachment_trashed_by_the_owner(self):
        """
        The owner trashed a recent attachment while an older one is still
        active: auto-deletion would have taken the older one first
        """
        older = self._create_attachment(days_ago=10)
        self._age(self.attachment, days_ago=1)
        self._move_to_trash(self.owner)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('0 restored, 1 kept (trashed by the owner), 0 skipped', output)
        self._assert_still_in_trash()
        older.refresh_from_db()
        self.assertIsNone(older.delete_status)

    def test_restores_oldest_attachment_when_newer_ones_are_active(self):
        self._create_attachment(days_ago=1)
        self._age(self.attachment, days_ago=10)
        self._move_to_trash(self.owner)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('1 restored, 0 kept (trashed by the owner), 0 skipped', output)
        self.attachment.refresh_from_db()
        self.assertIsNone(self.attachment.delete_status)

    def test_rerun_restores_the_rest_of_a_user(self):
        """
        Attachments restored by an earlier, interrupted run are active again
        and older than the ones left in trash. They must not make the command
        keep the rest in trash.
        """
        restored_earlier = self._create_attachment(days_ago=20)
        self._create_attachment(days_ago=1)
        self._age(self.attachment, days_ago=10)
        self._move_to_trash(self.owner)
        self._move_to_trash(self.owner, attachment=restored_earlier)
        # What the earlier run did for its first chunk
        AttachmentTrash.toggle_statuses([restored_earlier.uid], active=True)
        AttachmentTrash.objects.filter(attachment_id=restored_earlier.pk).delete()

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        self.assertIn('1 restored, 0 kept (trashed by the owner), 0 skipped', output)
        self.attachment.refresh_from_db()
        self.assertIsNone(self.attachment.delete_status)

    def test_dry_run_counts_orphans(self):
        self._make_orphans(self.attachment)

        output = self._call_command()

        assert '1 orphan attachment(s)' in output
        assert 'for 1 user(s)' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE

    def test_restores_orphan_attachment(self):
        """
        An attachment left `pending-delete` without trash entry, by an
        auto-deletion task killed half-way, is restored with its storage
        """
        self._make_orphans(self.attachment)
        self.owner_profile.refresh_from_db()
        assert self.owner_profile.attachment_storage_bytes < self.original_storage_bytes

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        assert 'Restored 1 orphan attachment(s) for 1 user(s), kept 0' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status is None
        self.owner_profile.refresh_from_db()
        assert (
            self.owner_profile.attachment_storage_bytes == self.original_storage_bytes
        )
        # No trash entry was ever created, so no put-back to log
        assert not AuditLog.objects.filter(
            object_id=self.attachment.pk, action=AuditAction.PUT_BACK
        ).exists()

    def test_restores_orphans_sharing_the_same_date_modified(self):
        """
        `toggle_statuses()` gives the same `date_modified` to every attachment
        of a call. Reading one attachment at a time must not skip any of them
        """
        others = [self._create_attachment(days_ago=days) for days in (10, 20)]
        self._make_orphans(self.attachment, *others)

        output = self._call_command(
            '--no-dry-run', '--author', 'superadmin', '--chunk-size', '1'
        )

        assert 'Restored 3 orphan attachment(s)' in output
        assert not Attachment.all_objects.filter(
            user=self.owner, delete_status=AttachmentDeleteStatus.PENDING_DELETE
        ).exists()

    def test_keeps_orphan_newer_than_oldest_active_attachment(self):
        older = self._create_attachment(days_ago=10)
        self._age(self.attachment, days_ago=1)
        self._make_orphans(self.attachment)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        assert 'Restored 0 orphan attachment(s) for 0 user(s), kept 1' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE
        older.refresh_from_db()
        assert older.delete_status is None

    def test_skips_orphan_outside_window(self):
        self._make_orphans(self.attachment)
        self.since = (timezone.now() + timedelta(minutes=1)).isoformat()

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        assert 'Restored 0 orphan attachment(s)' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE

    def test_skips_orphans_of_excluded_users(self):
        self._make_orphans(self.attachment)

        output = self._call_command(
            '--no-dry-run',
            '--author',
            'superadmin',
            '--exclude-user-id',
            str(self.owner.pk),
        )

        assert 'Restored 0 orphan attachment(s)' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE

    def test_trash_entries_are_not_counted_as_orphans(self):
        orphan = self._create_attachment(days_ago=20)
        self._age(self.attachment, days_ago=10)
        self.owner_profile.refresh_from_db()
        storage_bytes = self.owner_profile.attachment_storage_bytes
        self._move_to_trash(self.owner)
        self._make_orphans(orphan)

        output = self._call_command('--no-dry-run', '--author', 'superadmin')

        assert 'Restored 1 attachment(s) for 1 user(s), kept 0, skipped 0' in output
        assert 'Restored 1 orphan attachment(s) for 1 user(s), kept 0' in output
        self.owner_profile.refresh_from_db()
        assert self.owner_profile.attachment_storage_bytes == storage_bytes

    def test_rerun_resumes_orphans_from_saved_position(self):
        """
        A run killed half-way saves where it was, so the next run does not
        read the window again from the start
        """
        first = self._create_attachment(days_ago=20)
        self._make_orphans(first)
        self._make_orphans(self.attachment)
        restore_orphan_chunk = Command._restore_orphan_chunk
        calls = []

        def fail_on_second_chunk(command, attachments):
            calls.append(attachments)
            if len(calls) == 2:
                raise KeyboardInterrupt
            return restore_orphan_chunk(command, attachments)

        with patch.object(Command, '_restore_orphan_chunk', fail_on_second_chunk):
            with pytest.raises(KeyboardInterrupt):
                self._call_command(
                    '--no-dry-run', '--author', 'superadmin', '--chunk-size', '1'
                )

        first.refresh_from_db()
        assert first.delete_status is None
        assert cache.get(LOCK_KEY) is None

        output = self._call_command(
            '--no-dry-run', '--author', 'superadmin', '--chunk-size', '1'
        )

        assert 'Resuming from the saved position' in output
        assert 'Restored 1 orphan attachment(s)' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status is None

    def test_rerun_resumes_trash_entries_from_saved_position(self):
        first = self._create_attachment(days_ago=20)
        self._age(self.attachment, days_ago=10)
        self._move_to_trash(self.owner, attachment=first)
        self._move_to_trash(self.owner)
        restore_chunk = Command._restore_chunk
        calls = []

        def fail_on_second_chunk(command, *args):
            calls.append(args)
            if len(calls) == 2:
                raise KeyboardInterrupt
            return restore_chunk(command, *args)

        with patch.object(Command, '_restore_chunk', fail_on_second_chunk):
            with pytest.raises(KeyboardInterrupt):
                self._call_command(
                    '--no-dry-run', '--author', 'superadmin', '--chunk-size', '1'
                )

        output = self._call_command(
            '--no-dry-run', '--author', 'superadmin', '--chunk-size', '1'
        )

        assert 'Resuming from the saved position' in output
        assert 'Restored 1 attachment(s) for 1 user(s), kept 0, skipped 0' in output
        self.attachment.refresh_from_db()
        assert self.attachment.delete_status is None
        self.owner_profile.refresh_from_db()
        assert self.owner_profile.attachment_storage_bytes > 0

    def test_rerun_updates_mongo_left_by_interrupted_orphan_chunk(self):
        """
        A run that dies after the kobocat commit of an orphan chunk but before
        Mongo is updated leaves the submission showing the attachment as
        deleted. The next run must update Mongo for it first
        """
        self._make_orphans(self.attachment)
        mongo_path = (
            'kobo.apps.trash_bin.management.commands.'
            'restore_auto_trashed_attachments.ParsedInstance.bulk_update_attachments'
        )

        with patch(mongo_path, side_effect=KeyboardInterrupt):
            with pytest.raises(KeyboardInterrupt):
                self._call_command('--no-dry-run', '--author', 'superadmin')

        self.attachment.refresh_from_db()
        assert self.attachment.delete_status is None
        assert cache.get(PENDING_MONGO_KEY) == [self.instance.pk]

        with patch(mongo_path) as bulk_update_attachments:
            output = self._call_command('--no-dry-run', '--author', 'superadmin')

        assert 'Updating Mongo for 1 submission(s) left by an interrupted run' in output
        bulk_update_attachments.assert_any_call([self.instance.pk])
        assert cache.get(PENDING_MONGO_KEY) is None

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
        # Enforcement enabled yesterday: the countdown is at 1 day today
        self.since = (timezone.now() - timedelta(days=1)).isoformat()
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
            'Storage counters to reset to 1 day(s): 1 (1 at 90 days or more)',
            dry_run_output,
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
            1,
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
            1,
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_only_resets_counters_of_given_users(self):
        self.since = (timezone.now() - timedelta(days=1)).isoformat()
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
            1,
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

    def _age(self, attachment, days_ago: int):
        """
        Make `attachment` created and last modified `days_ago` days ago,
        i.e. before the outage window
        """
        date = timezone.now() - timedelta(days=days_ago)
        Attachment.all_objects.filter(pk=attachment.pk).update(
            date_created=date, date_modified=date
        )

    def _create_attachment(self, days_ago: int):
        """
        Create another attachment for the owner, created `days_ago` days ago
        """
        *_, attachment = self._create_test_asset_and_submission(user=self.owner)
        self._age(attachment, days_ago)
        attachment.refresh_from_db()
        return attachment

    def _make_orphans(self, *attachments):
        """
        Do what `move_to_trash()` does before it gets killed: mark the
        attachments `pending-delete` and subtract their storage, without
        creating any trash entry
        """
        AttachmentTrash.toggle_statuses(
            [attachment.uid for attachment in attachments], active=False
        )

    def _move_to_trash(self, request_author: User, attachment=None):
        attachment = attachment or self.attachment
        move_to_trash(
            request_author=request_author,
            objects_list=[
                {
                    'pk': attachment.pk,
                    'asset_id': attachment.xform.asset.pk,
                    'asset_uid': attachment.xform.asset.uid,
                    'attachment_uid': attachment.uid,
                    'attachment_basename': attachment.media_file_basename,
                }
            ],
            grace_period=30,
            trash_type='attachment',
        )
