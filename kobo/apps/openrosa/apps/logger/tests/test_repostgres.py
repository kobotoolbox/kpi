import contextlib
import csv
import datetime
import glob
import io
import os
import tempfile
import uuid as uuid_module
from unittest.mock import patch

from ddt import data, ddt
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm

# The XForm, submission and media builders are shared with the form-version
# tests. Reusing them keeps the fixtures on the real submission path rather than
# hand-built rows that could drift from what production stores
from kobo.apps.openrosa.apps.logger.tests.test_form_versions import (
    FORM_UUID,
    ID_STRING,
    MEDIA_QUESTION,
    submission_xml,
    xform_json,
    xform_xml,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kobo.apps.openrosa.libs.utils.logger_tools import (
    create_instance,
    get_instance_lock,
)
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.models.asset import Asset

LOCK_TARGET = (
    'kobo.apps.openrosa.apps.logger.management.commands.repostgres.get_instance_lock'
)


class RepostgresRebuildAttachmentsTestCase(TestCase):
    """
    The `repostgres` command rebuilds the attachment rows a submission lost,
    reading the files from storage and the identity from the Mongo document.
    """

    def setUp(self):
        self.user = User.objects.create(username='bob')
        UserProfile.objects.get_or_create(user=self.user)

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

        # The form carrying the media question these tests rebuild. The mock
        # deployment made a form of its own under `id_string == asset.uid`, so
        # this one keeps the shared `aVersionedForm` id the submission targets
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

        self.backup_path = tempfile.mkdtemp()
        self.addCleanup(self._drop_mongo)

        self.instance, self.attachment = self._submit_with_photo('first.jpg')
        self._write_mongo(self.instance)

        self.attachment_id = self.attachment.pk
        self.media_file_name = self.attachment.media_file.name
        self.file_size = self.attachment.media_file_size
        self.file_hash = self.attachment.hash

    def test_rebuild_restores_missing_attachments(self):
        """
        Rows lost while the files and the Mongo document survive: the command
        must insert them back with every field `save()` fills, not just the
        columns the buggy `bulk_create()` set. Without the fix this dies with an
        IntegrityError on the NOT NULL `user_id`/`xform_id`.
        """

        self.instance.refresh_from_db()
        instance_date_created = self.instance.date_created

        # Lose the rows without firing `pre_delete_attachment`, which would also
        # remove the file and adjust the counter. The scenario is rows gone,
        # file and Mongo intact
        rows = Attachment.all_objects.filter(pk=self.attachment_id)
        rows._raw_delete(rows.db)
        assert not Attachment.all_objects.filter(pk=self.attachment_id).exists()
        assert default_kobocat_storage.exists(self.media_file_name)

        self.xform.refresh_from_db()
        storage_before = self.xform.attachment_storage_bytes

        call_command(
            'repostgres',
            id_string=ID_STRING,
            backup_path=self.backup_path,
            verbosity=0,
        )

        attachment = Attachment.all_objects.get(pk=self.attachment_id)
        assert attachment.pk == self.attachment_id
        assert attachment.user_id == self.user.pk
        assert attachment.xform_id == self.xform.pk
        assert attachment.date_created == instance_date_created
        assert attachment.media_file_size == self.file_size
        assert attachment.hash == self.file_hash
        assert attachment.deleted_at is None

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes - storage_before == self.file_size

    def test_rebuild_revives_existing_attachment_without_double_counting(self):
        """
        When the row still exists but is soft-deleted, the command's match check
        misses it and it reaches the rebuild. The conflicting row must be
        revived in place, not counted as a fresh attachment.
        """

        Attachment.all_objects.filter(pk=self.attachment_id).update(
            deleted_at=timezone.now()
        )
        date_created_before = Attachment.all_objects.get(
            pk=self.attachment_id
        ).date_created

        self.xform.refresh_from_db()
        storage_before = self.xform.attachment_storage_bytes

        call_command(
            'repostgres',
            id_string=ID_STRING,
            backup_path=self.backup_path,
            verbosity=0,
        )

        attachment = Attachment.all_objects.get(pk=self.attachment_id)
        assert attachment.pk == self.attachment_id
        assert attachment.deleted_at is None
        assert attachment.date_created == date_created_before

        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == storage_before

    def test_rebuild_skips_submission_locked_elsewhere(self):
        """
        While the submission path or another run holds the submission, the
        rebuild must leave it alone and report it for a later run, rather than
        race them.
        """

        rows = Attachment.all_objects.filter(pk=self.attachment_id)
        rows._raw_delete(rows.db)
        self.xform.refresh_from_db()
        storage_before = self.xform.attachment_storage_bytes

        @contextlib.contextmanager
        def lock_held_elsewhere(*args):
            yield False

        with patch(LOCK_TARGET, lock_held_elsewhere):
            call_command(
                'repostgres',
                id_string=ID_STRING,
                backup_path=self.backup_path,
                verbosity=0,
                stderr=io.StringIO(),
            )

        assert not Attachment.all_objects.filter(pk=self.attachment_id).exists()
        self.xform.refresh_from_db()
        assert self.xform.attachment_storage_bytes == storage_before

        (errors_csv,) = glob.glob(os.path.join(self.backup_path, '*', 'errors.csv'))
        with open(errors_csv) as csvfile:
            (row,) = list(csv.reader(csvfile))
        assert row[0] == str(self.instance.pk)
        assert row[2] == 'Skipped: submission is being processed elsewhere'

    def test_rebuild_takes_submission_lock_before_reading_attachments(self):
        """
        The rebuild must hold the lock the submission path takes for the same
        submission before reading its attachments, so a resubmission or another
        run cannot race it. It must not lock the `Instance` row: deletion locks
        the attachments first, and the two would deadlock.
        """

        rows = Attachment.all_objects.filter(pk=self.attachment_id)
        rows._raw_delete(rows.db)

        with patch(LOCK_TARGET, wraps=get_instance_lock) as lock:
            with CaptureQueriesContext(connection) as context:
                call_command(
                    'repostgres',
                    id_string=ID_STRING,
                    backup_path=self.backup_path,
                    verbosity=0,
                )

        # Same key as `create_instance()`, so both paths contend for one lock
        lock.assert_called_once_with(self.instance.root_uuid, self.xform.pk)

        queries = [query['sql'] for query in context.captured_queries]
        lock_indexes = [
            index for index, sql in enumerate(queries) if 'pg_try_advisory_lock' in sql
        ]
        attachment_indexes = [
            index for index, sql in enumerate(queries) if '"logger_attachment"' in sql
        ]
        assert lock_indexes
        assert attachment_indexes
        assert lock_indexes[0] < attachment_indexes[0]
        assert not any(
            'FOR UPDATE' in sql and '"logger_instance"' in sql for sql in queries
        )

    def _clear_storage_dir(self, storage_dir: str):
        """
        Remove the files a submission left on the persistent test storage, so a
        later run does not collide with them and get a suffixed filename.
        """

        _, files = default_kobocat_storage.listdir(storage_dir)
        for name in files:
            default_kobocat_storage.delete(os.path.join(storage_dir, name))

    def _drop_mongo(self):
        settings.MONGO_DB.instances.drop()

    def _submit_with_photo(self, filename: str) -> tuple[Instance, Attachment]:
        # A fresh instance id per submission, so the file lands in its own
        # `root_uuid` directory as it does in production. A shared id would reuse
        # the persistent test storage dir and make Django suffix the stored name
        instance = create_instance(
            self.user.username,
            io.BytesIO(
                submission_xml(
                    version_uid=self.version_1,
                    instance_id=f'uuid:{uuid_module.uuid4()}',
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

        attachment = Attachment.all_objects.filter(instance=instance).latest('pk')
        self.addCleanup(
            self._clear_storage_dir, os.path.dirname(attachment.media_file.name)
        )

        return instance, attachment

    def _write_mongo(self, instance: Instance):
        """
        Write the Mongo document the command reads, and make sure it carries the
        attachment identity the rebuild preserves before relying on it.
        """

        instance.parsed_instance.update_mongo(asynchronous=False)
        doc = settings.MONGO_DB.instances.find_one({'_id': instance.pk})
        assert doc is not None
        assert doc['_attachments']
        assert doc['_attachments'][0]['id'] == self.attachment.pk


@ddt
class RepostgresSubmissionTimeTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='bob')

        self.asset = Asset.objects.create(
            owner=self.user,
            content={
                'survey': [
                    {'type': 'text', 'name': 'q1', 'label': ['Q1']},
                ]
            },
        )
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.version_1 = self.asset.latest_deployed_version_uid

    @data(
        '2026-01-01T01:01:01',  # naive
        '2026-01-01T06:01:01+05:00',  # different timezone
        '2026-01-01T01:01:01+00:00',  # in UTC
    )
    def test_parse_submission_time(self, time_str):
        submissions = [{'__version__': self.version_1, 'q1': 'a1'}]
        self.asset.deployment.mock_submissions(submissions)
        submission_id = submissions[0]['_id']
        settings.MONGO_DB.instances.update_one(
            {'_id': submission_id},
            {'$set': {'_submission_time': time_str}},
        )
        xform = XForm.objects.get(kpi_asset_uid=self.asset.uid)
        ParsedInstance.objects.filter(instance__pk=submission_id)._raw_delete(
            using=ParsedInstance.objects.db
        )
        Instance.objects.filter(pk=submission_id)._raw_delete(using=Instance.objects.db)
        call_command(
            'repostgres',
            id_string=xform.id_string,
        )
        i = Instance.objects.get(pk=submission_id)
        expected_date = datetime.datetime(
            year=2026,
            month=1,
            day=1,
            hour=1,
            minute=1,
            second=1,
            microsecond=0,
            tzinfo=datetime.timezone.utc,
        )
        assert i.date_created == expected_date
