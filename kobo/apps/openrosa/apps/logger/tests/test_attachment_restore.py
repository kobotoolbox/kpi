import io
import unicodedata
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from redis.exceptions import LockNotOwnedError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus

# The XML builders live with the tests of the rule this replays. Copying them
# here would let the two drift apart, which is what
# `get_submission_media_basenames()` exists to prevent
from kobo.apps.openrosa.apps.logger.tests.test_form_versions import (
    FORM_UUID,
    MEDIA_QUESTION,
    submission_xml,
    xform_json,
    xform_xml,
)
from kobo.apps.openrosa.apps.logger.utils import attachment_restore
from kobo.apps.openrosa.apps.logger.utils.attachment_restore import AttachmentRestorer
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kpi.models.asset import Asset


class AttachmentRestorerTestCase(TestCase):
    """
    Bring back the files a submission still references, and only those.
    """

    def setUp(self):
        self.user = User.objects.create(username='bob')
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

        self.asset = Asset.objects.create(
            owner=self.user,
            content={
                'survey': [
                    {'type': 'text', 'name': 'q1', 'label': ['Q1']},
                    {'type': 'image', 'name': MEDIA_QUESTION, 'label': ['Photo']},
                ]
            },
        )
        self.asset.deploy(backend='mock', active=True)
        self.version_1 = self.asset.latest_deployed_version_uid

        self.xform = XForm.objects.create(
            xml=xform_xml(media_question=MEDIA_QUESTION),
            user=self.user,
            json=xform_json(self.version_1, media_question=MEDIA_QUESTION),
            uuid=FORM_UUID,
            require_auth=False,
            kpi_asset_uid=self.asset.uid,
        )

        # The mock deployment made a form of its own, and the one built above
        # is the one carrying the media question these tests are about. Point
        # the deployment at it, so that resolving the project by its uid, which
        # is all the command and the task are given, lands on it
        deployment_data = dict(self.asset._deployment_data)
        deployment_data['backend_response'] = {
            **deployment_data['backend_response'],
            'formid': self.xform.pk,
            # `OpenRosaDeploymentBackend.xform` refuses a form whose `id_string`
            # is not the one the deployment recorded
            'id_string': self.xform.id_string,
        }
        # Written straight to the column: `Asset.save()` refuses to run without
        # the content it was told to defer
        Asset.objects.filter(pk=self.asset.pk).update(_deployment_data=deployment_data)

        # The lock needs a real Redis, whose scripts the locmem cache cannot
        # run, so this is the shared test cache. Only the keys of this test's
        # own project are removed, never the whole cache
        self.addCleanup(
            cache.delete_many,
            [
                AttachmentRestorer(self.xform, dry_run=True).cursor_cache_key,
                AttachmentRestorer(self.xform, dry_run=False).cursor_cache_key,
                AttachmentRestorer(self.xform).lock_cache_key,
            ],
        )

        class FakeRequest:
            pass

        self.request = FakeRequest()
        self.request.user = self.user
        self.request.user.has_perm = lambda *args, **kwargs: True

    def test_a_file_the_submission_still_references_comes_back(self):
        _, attachment = self._submit_with_photo('first.jpg')
        size = attachment.media_file_size
        self._kill(attachment)

        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status is None
        assert attachment.deleted_at is None

        self.profile.refresh_from_db()
        assert self.profile.attachment_storage_bytes == size

    def test_a_file_the_submission_does_not_reference_stays_dead(self):
        instance, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # The Collect case, by far the most common: a file the client uploaded
        # and the form never referenced
        Instance.objects.filter(pk=instance.pk).update(
            xml=submission_xml(version_uid=self.version_1)
        )

        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert attachment.deleted_at is not None

    def test_a_dry_run_reports_without_restoring_anything(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        restorer = self._restore(dry_run=True)

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert restorer.restored == 1
        self.profile.refresh_from_db()
        assert self.profile.attachment_storage_bytes == 0

    def test_a_dry_run_cursor_does_not_trim_the_front_of_a_real_run(self):
        """
        A dry run walks the same rows without restoring any of them, so sharing
        a cursor with a real run would silently skip whatever the dry run
        already looked at.
        """

        dry = AttachmentRestorer(self.xform, dry_run=True)
        write = AttachmentRestorer(self.xform, dry_run=False)

        assert dry.cursor_cache_key != write.cursor_cache_key

    def test_an_attachment_of_another_project_is_never_looked_at(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # Another user, since the two forms are built from the same XML and a
        # form's `id_string` is only unique per owner
        other_user = User.objects.create(username='alice')
        other_xform = XForm.objects.create(
            xml=xform_xml(media_question=MEDIA_QUESTION),
            user=other_user,
            json=xform_json(self.version_1, media_question=MEDIA_QUESTION),
            uuid='0f0b2b0a0b0b4b0a8b0b0b0b0b0b0b0b',
            require_auth=False,
            kpi_asset_uid='aOtHeRaSsEtUiD',
        )

        restorer = AttachmentRestorer(other_xform, dry_run=False)
        restorer.run()

        assert restorer.scanned == 0
        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

    def test_a_legacy_row_stored_in_nfd_matches_a_composed_node(self):
        """
        Rows written before attachments were composed on the way in can hold a
        decomposed name, which a byte-exact comparison never lines up with the
        submission. Same reasoning as `get_soft_deleted_attachments()`, which
        normalizes both sides.
        """

        composed = 'Guérisseur.jpg'
        instance, attachment = self._submit_with_photo(composed)
        assert composed in instance.xml

        # What a row written before that normalization looks like
        decomposed = unicodedata.normalize('NFD', composed)
        assert decomposed != composed
        Attachment.all_objects.filter(pk=attachment.pk).update(
            media_file_basename=decomposed
        )
        attachment.refresh_from_db()
        self._kill(attachment)

        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status is None

    def test_a_composed_row_matches_a_submission_written_in_nfd(self):
        """
        The direction production actually shows, seen on attachment 226210620:
        the row holds the composed name, the submission the decomposed one, the
        two differing by a single combining mark. macOS hands over NFD, and
        `save_attachments()` has composed the column since DEV-2686.
        """

        decomposed = unicodedata.normalize('NFD', 'Guérisseur.jpg')
        instance, attachment = self._submit_with_photo(decomposed)

        # What the client sent, left in the submission untouched
        Instance.objects.filter(pk=instance.pk).update(
            xml=submission_xml(
                version_uid=self.version_1,
                media_question=MEDIA_QUESTION,
                filename=decomposed,
            )
        )
        Attachment.all_objects.filter(pk=attachment.pk).update(
            media_file_basename=unicodedata.normalize('NFC', decomposed)
        )
        attachment.refresh_from_db()
        self._kill(attachment)

        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status is None

    def test_a_second_run_on_the_same_project_is_refused(self):
        """
        Two runs overlapping would credit the same bytes twice:
        `bulk_update_attachment_storage_counters()` keeps every row whose
        `delete_status` is already `NULL`, which the other run has just made
        true of them, and it runs outside the transaction that did so.
        """

        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        holder = AttachmentRestorer(self.xform, dry_run=False)
        assert holder._acquire_lock()

        with self.assertRaises(attachment_restore.ProjectAlreadyBeingRestoredError):
            AttachmentRestorer(self.xform, dry_run=False).run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

        # And the project is free again as soon as the holder lets go
        holder._release_lock()
        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status is None

    def test_a_name_already_in_use_on_the_submission_is_left_alone(self):
        instance, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # `save_attachments()` looks a basename up through the default manager,
        # which hides the soft-deleted rows, so the same name can sit on a dead
        # row and on an undeleted one at once. Restoring it would show the same
        # file twice
        duplicate = Attachment.objects.create(
            instance=instance,
            xform=self.xform,
            user=self.user,
            media_file=SimpleUploadedFile('first.jpg', b'jpeg2'),
            media_file_basename='first.jpg',
            media_file_size=5,
            mimetype='image/jpeg',
        )

        self._restore()

        attachment.refresh_from_db()
        duplicate.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert duplicate.delete_status is None

    def test_a_row_holding_no_basename_is_never_restored(self):
        """
        `media_file` is the sanitized storage path and can carry the suffix
        Django appends on a collision, so matching on it would be a guess, and
        this restores files. 2,395,614 rows hold no `media_file_basename` on
        production, and the set cannot grow.
        """

        _, attachment = self._submit_with_photo('first.jpg')
        Attachment.all_objects.filter(pk=attachment.pk).update(media_file_basename=None)
        attachment.refresh_from_db()
        self._kill(attachment)

        restorer = self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert restorer.restored == 0
        assert restorer.skipped_without_basename == 1

    def test_an_audit_file_is_never_restored(self):
        instance, attachment = self._submit_with_photo('first.jpg')
        Attachment.all_objects.filter(pk=attachment.pk).update(
            media_file_basename='audit.csv'
        )
        attachment.refresh_from_db()
        self._kill(attachment)

        self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

    def test_mongo_is_rewritten_for_the_submissions_touched_and_no_other(self):
        restored_instance, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # A second submission nobody touched, whose file was never retired
        self._submit_with_photo(
            'second.jpg', instance_id='uuid:55d873b2-3a25-4370-8cd9-c41ed4156d08'
        )

        with patch.object(
            attachment_restore.ParsedInstance, 'bulk_update_attachments'
        ) as rewrite:
            self._restore()

        rewrite.assert_called_once_with([restored_instance.pk])

    def test_a_failed_mongo_rewrite_leaves_the_rows_to_the_next_pass(self):
        """
        A restored row is no longer soft-deleted, so `_fetch_batch()` never
        hands it over again. Committing the rows without Mongo would leave the
        file restored and invisible, with no later pass to repair it.
        """

        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        with patch.object(
            attachment_restore.ParsedInstance,
            'bulk_update_attachments',
            side_effect=OSError('mongo is down'),
        ):
            with self.assertRaises(OSError):
                self._restore()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        self.profile.refresh_from_db()
        assert self.profile.attachment_storage_bytes == 0

        # A run that blew up still hands the project back
        assert not cache.has_key(AttachmentRestorer(self.xform).lock_cache_key)

    def test_one_name_of_a_submission_comes_back_once_across_batches(self):
        """
        Two rows of one submission can hold the same name, which puts them in
        different batches when the batch is small. The most recent must be the
        one restored, whichever batch it falls in, and the other stays dead.
        """

        older, newer = self._two_rows_under_one_name()

        # One row per batch, so the two are never judged together
        with patch.object(attachment_restore, 'CHUNK_SIZE', 1):
            restorer = self._restore()

        older.refresh_from_db()
        newer.refresh_from_db()
        assert newer.delete_status is None
        assert older.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert restorer.restored == 1

    def test_a_dry_run_counts_one_name_once_across_batches(self):
        """
        A dry run makes nothing live, so the database cannot tell it that a name
        was already picked in an earlier batch. It has to remember, or its report
        would not match what a real run then does.
        """

        self._two_rows_under_one_name()

        with patch.object(attachment_restore, 'CHUNK_SIZE', 1):
            restorer = self._restore(dry_run=True)

        assert restorer.restored == 1

    def test_a_run_whose_lock_was_taken_over_stops(self):
        """
        A lock that expired in the middle of a run can be claimed by another.
        The first run has to notice at the end of its batch and stop, rather
        than keep restoring alongside the second.
        """

        _, older = self._submit_with_photo('first.jpg')
        _, newer = self._submit_with_photo(
            'second.jpg', instance_id='uuid:a0b1c2d3-3a25-4370-8cd9-c41ed4156d07'
        )
        self._kill(older)
        self._kill(newer)

        restorer = AttachmentRestorer(self.xform, dry_run=False)
        other = AttachmentRestorer(self.xform, dry_run=False)
        restore_batch = restorer._restore_batch

        def take_over_then_restore(*args):
            # As if the lock had expired and another run had claimed it
            cache.delete(restorer.lock_cache_key)
            assert other._acquire_lock()
            return restore_batch(*args)

        with patch.object(attachment_restore, 'CHUNK_SIZE', 1):
            with patch.object(
                restorer, '_restore_batch', side_effect=take_over_then_restore
            ):
                with self.assertRaises(LockNotOwnedError):
                    restorer.run()

        # The batch in progress is committed, the next one is never started
        older.refresh_from_db()
        newer.refresh_from_db()
        assert newer.delete_status is None
        assert older.delete_status == AttachmentDeleteStatus.SOFT_DELETED

        # And the other run still holds the project
        assert cache.has_key(other.lock_cache_key)
        other._release_lock()

    def test_the_cursor_resumes_where_an_interrupted_run_stopped(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        restorer = AttachmentRestorer(self.xform, dry_run=False)
        # As if a run walking newest first had been interrupted just below
        # this row
        cache.set(restorer.cursor_cache_key, attachment.pk, timeout=None)

        restorer.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        # Reaching the end clears the cursor, so the next run starts over
        assert cache.get(restorer.cursor_cache_key) is None

    def test_no_resume_ignores_the_cursor_of_an_interrupted_run(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        restorer = AttachmentRestorer(self.xform, dry_run=False, resume=False)
        cache.set(restorer.cursor_cache_key, attachment.pk, timeout=None)

        restorer.run()

        attachment.refresh_from_db()
        assert attachment.delete_status is None

    def test_the_command_writes_nothing_unless_it_is_asked_to(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        call_command(
            'restore_soft_deleted_attachments',
            asset_uid=self.asset.uid,
            verbosity=0,
        )

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

        call_command(
            'restore_soft_deleted_attachments',
            asset_uid=self.asset.uid,
            dry_run=False,
            verbosity=0,
        )

        attachment.refresh_from_db()
        assert attachment.delete_status is None

    def test_the_command_mails_its_log_when_asked_to(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        call_command(
            'restore_soft_deleted_attachments',
            asset_uid=self.asset.uid,
            dry_run=False,
            email=['support@example.com'],
            verbosity=0,
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['support@example.com']
        assert attachment.media_file_basename in mail.outbox[0].body

    def test_the_command_mails_the_log_of_a_run_that_failed(self):
        """
        The log is the only trace of a run launched from the admin, so a failure
        has to reach the person who asked for it rather than die in the worker.
        """

        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        with patch.object(
            attachment_restore.ParsedInstance,
            'bulk_update_attachments',
            side_effect=OSError('mongo is down'),
        ):
            with self.assertRaises(OSError):
                call_command(
                    'restore_soft_deleted_attachments',
                    asset_uid=self.asset.uid,
                    dry_run=False,
                    email=['support@example.com'],
                    verbosity=0,
                )

        assert len(mail.outbox) == 1
        assert 'FAILED. OSError: mongo is down' in mail.outbox[0].body

    def test_the_command_refuses_a_project_that_does_not_exist(self):
        with self.assertRaises(CommandError) as context:
            call_command(
                'restore_soft_deleted_attachments',
                asset_uid='aNoSuchAsset',
                verbosity=0,
            )

        assert 'does not exist' in str(context.exception)

    def test_the_command_mails_the_log_of_a_project_it_cannot_resolve(self):
        with self.assertRaises(CommandError):
            call_command(
                'restore_soft_deleted_attachments',
                asset_uid='aNoSuchAsset',
                email=['support@example.com'],
                verbosity=0,
            )

        assert len(mail.outbox) == 1
        assert 'FAILED. CommandError: Asset `aNoSuchAsset` does not exist' in (
            mail.outbox[0].body
        )

    def _kill(self, attachment: Attachment):
        """
        Retire the attachment the way `get_soft_deleted_attachments()` did,
        storage counter included, leaving the submission XML untouched.
        """

        Attachment.all_objects.filter(pk=attachment.pk).update(
            delete_status=AttachmentDeleteStatus.SOFT_DELETED,
            deleted_at=attachment.date_created,
        )
        UserProfile.objects.filter(pk=self.profile.pk).update(
            attachment_storage_bytes=0
        )
        attachment.refresh_from_db()

    def _restore(self, dry_run: bool = False) -> AttachmentRestorer:
        restorer = AttachmentRestorer(self.xform, dry_run=dry_run)
        restorer.run()

        return restorer

    def _submit_with_photo(
        self,
        filename: str,
        instance_id: str = 'uuid:55d873b2-3a25-4370-8cd9-c41ed4156d07',
    ) -> tuple[Instance, Attachment]:
        instance = create_instance(
            self.user.username,
            io.BytesIO(
                submission_xml(
                    version_uid=self.version_1,
                    instance_id=instance_id,
                    media_question=MEDIA_QUESTION,
                    filename=filename,
                ).encode()
            ),
            media_files=[
                SimpleUploadedFile(filename, b'jpeg', content_type='image/jpeg')
            ],
            request=self.request,
            check_usage_limits=False,
        )

        return instance, Attachment.all_objects.filter(instance=instance).latest('pk')

    def _two_rows_under_one_name(self) -> tuple[Attachment, Attachment]:
        """
        Return two soft-deleted rows of one submission holding the same name,
        oldest first.
        """

        instance, older = self._submit_with_photo('first.jpg')
        newer = Attachment.objects.create(
            instance=instance,
            xform=self.xform,
            user=self.user,
            media_file=SimpleUploadedFile('first.jpg', b'jpeg2'),
            media_file_basename='first.jpg',
            media_file_size=5,
            mimetype='image/jpeg',
        )
        self._kill(older)
        self._kill(newer)

        return older, newer
