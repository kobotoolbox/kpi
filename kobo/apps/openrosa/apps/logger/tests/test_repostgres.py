import io
import os
import tempfile
import uuid as uuid_module

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
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
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.models.asset import Asset


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
