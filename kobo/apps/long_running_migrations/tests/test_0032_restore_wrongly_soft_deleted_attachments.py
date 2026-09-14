import importlib
import io
import unicodedata
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus

# The XML builders live with the tests of the rule this migration replays.
# Copying them here would let the two drift apart, which is what
# `get_submission_media_basenames()` exists to prevent
from kobo.apps.openrosa.apps.logger.tests.test_form_versions import (
    FORM_UUID,
    MEDIA_QUESTION,
    submission_xml,
    xform_json,
    xform_xml,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kpi.models.asset import Asset

MIGRATION_NAME = '0032_restore_wrongly_soft_deleted_attachments'

job = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs'
    '.0032_restore_wrongly_soft_deleted_attachments'
)

LOCMEM_CACHE = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=LOCMEM_CACHE)
class Migrate0032RestoreAttachmentsTestCase(TestCase):
    """
    Bring back the files a submission still references, and only those.
    """

    def setUp(self):
        cache.clear()

        # The bound past which a deletion is no longer this migration's
        # business. The data migration already inserted the row
        self.registered_at = timezone.now()
        LongRunningMigration.objects.update_or_create(
            name=MIGRATION_NAME, defaults={'date_created': self.registered_at}
        )

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

        class FakeRequest:
            pass

        self.request = FakeRequest()
        self.request.user = self.user
        self.request.user.has_perm = lambda *args, **kwargs: True

    def test_a_file_the_submission_still_references_comes_back(self):
        _, attachment = self._submit_with_photo('first.jpg')
        size = attachment.media_file_size
        self._kill(attachment)

        job.run()

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

        job.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert attachment.deleted_at is not None

    def test_a_legacy_row_stored_in_nfd_matches_a_composed_node(self):
        """
        Rows written before attachments were composed on the way in can hold a
        decomposed name, which a byte-exact comparison never lines up with the
        submission. Same reasoning as `get_soft_deleted_attachments()`, which
        normalizes both sides.
        """

        composed = 'Gu\u00e9risseur.jpg'
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

        job.run()

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

        job.run()

        attachment.refresh_from_db()
        duplicate.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        assert duplicate.delete_status is None

    def test_an_audit_file_is_never_restored(self):
        instance, attachment = self._submit_with_photo('first.jpg')
        Attachment.all_objects.filter(pk=attachment.pk).update(
            media_file_basename='audit.csv'
        )
        attachment.refresh_from_db()
        self._kill(attachment)

        job.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

    def test_a_form_xml_is_read_once_however_many_batches_it_spans(self):
        """
        An XForm row carries its whole XML, seven megabytes for the largest on
        production, and a run walks millions of attachments. The xpaths are
        memoized for the run, and a form already memoized is loaded without
        that column at all.
        """

        for index in range(3):
            _, attachment = self._submit_with_photo(
                f'photo-{index}.jpg',
                instance_id=f'uuid:55d873b2-3a25-4370-8cd9-c41ed415600{index}',
            )
            # Retired at different moments, so each lands in its own batch
            self._kill(attachment, days_ago=index + 1)

        connection = connections[XForm.objects.db]

        with CaptureQueriesContext(connection) as queries, patch.object(
            job,
            'get_xform_media_question_xpaths',
            wraps=job.get_xform_media_question_xpaths,
        ) as parse, patch.object(job, 'CHUNK_SIZE', 1):
            job.run()

        # Parsed once for the three batches, thanks to the memo
        assert parse.call_count == 1

        # And read from the database once, the two other batches asking for
        # every column of the form but that one
        xml_reads = [
            query['sql']
            for query in queries.captured_queries
            if '"logger_xform"."xml"' in query['sql']
        ]
        assert len(xml_reads) == 1

    def test_mongo_is_rewritten_for_the_submissions_touched_and_no_other(self):
        restored_instance, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # A second submission nobody touched, whose file was never retired
        self._submit_with_photo(
            'second.jpg', instance_id='uuid:55d873b2-3a25-4370-8cd9-c41ed4156d08'
        )

        with patch.object(job.ParsedInstance, 'bulk_update_attachments') as rewrite:
            job.run()

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
            job.ParsedInstance,
            'bulk_update_attachments',
            side_effect=OSError('mongo is down'),
        ):
            with self.assertRaises(OSError):
                job.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        self.profile.refresh_from_db()
        assert self.profile.attachment_storage_bytes == 0

    def test_a_deletion_younger_than_this_migration_is_none_of_its_business(self):
        """
        The bound is the date this migration was registered, not the clock.
        Reading the clock would move it at every restart, and a run spanning
        several Celery cycles would judge deletions made by a version that
        already gets the comparison right.
        """

        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment, days_ago=-1)

        job.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED

    def test_one_name_of_a_submission_comes_back_once_across_batches(self):
        """
        Two rows of one submission can hold the same name and have been retired
        at different moments, which puts them in different batches. The one
        restored first makes the name live, and the guard blocks the other.

        Which of the two wins is the earliest deletion here, where a single
        batch would have kept the highest pk. They name the same file, so the
        difference is not worth carrying instance-wide state through the walk.
        """

        instance, first = self._submit_with_photo('first.jpg')
        second = Attachment.objects.create(
            instance=instance,
            xform=self.xform,
            user=self.user,
            media_file=SimpleUploadedFile('first.jpg', b'jpeg2'),
            media_file_basename='first.jpg',
            media_file_size=5,
            mimetype='image/jpeg',
        )
        self._kill(first, days_ago=2)
        self._kill(second, days_ago=1)

        # One row per batch, so the second is judged after the first came back
        with patch.object(job, 'CHUNK_SIZE', 1):
            job.run()

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.delete_status is None
        assert second.delete_status == AttachmentDeleteStatus.SOFT_DELETED

    def test_the_cursor_skips_what_an_earlier_run_already_walked(self):
        _, attachment = self._submit_with_photo('first.jpg')
        self._kill(attachment)

        # As if a run had been interrupted just past this row
        cache.set(
            job.CURSOR_CACHE_KEY, (attachment.deleted_at, attachment.pk), timeout=None
        )

        job.run()

        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.SOFT_DELETED
        # Reaching the end clears the cursor, so the next cycle starts over
        assert cache.get(job.CURSOR_CACHE_KEY) is None

    def _kill(self, attachment: Attachment, days_ago: int = 1):
        """
        Retire the attachment the way `get_soft_deleted_attachments()` did,
        storage counter included, leaving the submission XML untouched.

        `days_ago` counts back from the day this migration was registered, as
        the rows it is meant to bring back all do.
        """

        Attachment.all_objects.filter(pk=attachment.pk).update(
            delete_status=AttachmentDeleteStatus.SOFT_DELETED,
            deleted_at=self.registered_at - timedelta(days=days_ago),
        )
        UserProfile.objects.filter(pk=self.profile.pk).update(
            attachment_storage_bytes=0
        )
        attachment.refresh_from_db()

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
