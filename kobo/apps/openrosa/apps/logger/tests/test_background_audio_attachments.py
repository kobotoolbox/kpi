import io
import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.tests.test_form_versions import (
    FORM_UUID,
    ID_STRING,
    xform_json,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils.logger_tools import create_instance
from kpi.models.asset import Asset
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)

# Enketo names the recording after the question, Collect after a timestamp
BACKGROUND_AUDIO_QUESTION = 'bg'
ENKETO_BACKGROUND_AUDIO = f'{BACKGROUND_AUDIO_QUESTION}-20261116_124216.webm'
COLLECT_BACKGROUND_AUDIO = '1731760936000.m4a'
PHOTO_QUESTION = 'photo'


def background_audio_xform_xml(
    with_photo: bool = True,
    with_background_audio: bool = True,
    with_audit: bool = True,
) -> str:
    """
    Build the XForm XML that pyxform writes for a form with a background audio
    question, an audit and a photo question, each of which can be left out.

    Background audio and audit have no control in the body. Only their
    `binary` bind and, for background audio, the `odk:recordaudio` action tell
    that they hold a file.
    """

    background_audio_node = (
        f'<{BACKGROUND_AUDIO_QUESTION}/>' if with_background_audio else ''
    )
    background_audio_bind = (
        f'<bind nodeset="/{ID_STRING}/{BACKGROUND_AUDIO_QUESTION}" type="binary"/>'
        '<odk:recordaudio event="odk-instance-load"'
        f' ref="/{ID_STRING}/{BACKGROUND_AUDIO_QUESTION}"/>'
        if with_background_audio
        else ''
    )
    audit_node = '<audit/>' if with_audit else ''
    audit_bind = (
        f'<bind nodeset="/{ID_STRING}/meta/audit" type="binary"/>' if with_audit else ''
    )
    photo_node = f'<{PHOTO_QUESTION}/>' if with_photo else ''
    photo_bind = (
        f'<bind nodeset="/{ID_STRING}/{PHOTO_QUESTION}" type="binary"/>'
        if with_photo
        else ''
    )
    photo_control = (
        f'<upload mediatype="image/*" ref="/{ID_STRING}/{PHOTO_QUESTION}">'
        '<label>Photo</label>'
        '</upload>'
        if with_photo
        else ''
    )

    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<h:html xmlns="http://www.w3.org/2002/xforms"'
        ' xmlns:h="http://www.w3.org/1999/xhtml"'
        ' xmlns:jr="http://openrosa.org/javarosa"'
        ' xmlns:odk="http://www.opendatakit.org/xforms">'
        '<h:head>'
        f'<h:title>{ID_STRING}</h:title>'
        '<model odk:xforms-version="1.0.0">'
        '<instance>'
        f'<{ID_STRING} id="{ID_STRING}">'
        '<formhub><uuid/></formhub>'
        f'{background_audio_node}'
        '<q1/>'
        f'{photo_node}'
        '<__version__/>'
        f'<meta>{audit_node}<instanceID/><deprecatedID/><rootUuid/></meta>'
        f'</{ID_STRING}>'
        '</instance>'
        f'{photo_bind}'
        f'{audit_bind}'
        f'<bind nodeset="/{ID_STRING}/meta/instanceID" type="string"/>'
        f'{background_audio_bind}'
        '</model>'
        '</h:head>'
        '<h:body>'
        f'<input ref="/{ID_STRING}/q1"><label>Q1</label></input>'
        f'{photo_control}'
        '</h:body>'
        '</h:html>'
    )


def background_audio_submission_xml(
    version_uid: str,
    background_audio: str = '',
    photo: str = '',
    audit: str = '',
    instance_id: str = 'uuid:3f1c2a0e-5f3b-4d0a-9a3e-2b1d6c8e7f90',
) -> str:
    """
    Build a submission of the form that `background_audio_xform_xml()`
    describes.
    """

    return (
        f'<{ID_STRING} id="{ID_STRING}">'
        f'<formhub><uuid>{FORM_UUID}</uuid></formhub>'
        f'<{BACKGROUND_AUDIO_QUESTION}>{background_audio}'
        f'</{BACKGROUND_AUDIO_QUESTION}>'
        '<q1>hello</q1>'
        f'<{PHOTO_QUESTION}>{photo}</{PHOTO_QUESTION}>'
        f'<__version__>{version_uid}</__version__>'
        f'<meta><audit>{audit}</audit><instanceID>{instance_id}</instanceID></meta>'
        f'</{ID_STRING}>'
    )


class TestBackgroundAudioAttachments(TestCase):
    """
    Background audio and audit files must survive the comparison that
    `get_soft_deleted_attachments()` makes between the attachments and the
    files that the submission references.
    """

    def setUp(self):
        self.user = User.objects.create(username='bob')
        UserProfile.objects.get_or_create(user=self.user)

        self.asset = Asset.objects.create(
            owner=self.user,
            content={
                'survey': [
                    {'type': 'background-audio', 'name': BACKGROUND_AUDIO_QUESTION},
                    {'type': 'text', 'name': 'q1', 'label': ['Q1']},
                    {'type': 'image', 'name': PHOTO_QUESTION, 'label': ['Photo']},
                    {'type': 'audit', 'name': 'audit'},
                ]
            },
        )
        self.asset.deploy(backend='mock', active=True)
        self.version_uid = self.asset.latest_deployed_version_uid

        self.xform = XForm.objects.create(
            xml=background_audio_xform_xml(),
            user=self.user,
            json=xform_json(self.version_uid, media_question=PHOTO_QUESTION),
            uuid=FORM_UUID,
            require_auth=False,
            kpi_asset_uid=self.asset.uid,
        )

        class FakeRequest:
            pass

        self.request = FakeRequest()
        self.request.user = self.user
        self.request.user.has_perm = lambda *args, **kwargs: True

    def test_enketo_background_audio_of_a_renamed_question_is_kept(self):
        """
        Enketo names the file after the question, so nothing in the name of a
        file recorded for a question other than `background-audio` says that it
        is background audio.
        """

        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid, background_audio=ENKETO_BACKGROUND_AUDIO
            ),
            [ENKETO_BACKGROUND_AUDIO],
        )

        assert self._delete_statuses(instance) == {ENKETO_BACKGROUND_AUDIO: None}

    def test_enketo_background_audio_is_kept_next_to_a_photo(self):
        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid,
                background_audio=ENKETO_BACKGROUND_AUDIO,
                photo='photo.jpg',
            ),
            [ENKETO_BACKGROUND_AUDIO, 'photo.jpg'],
        )

        assert self._delete_statuses(instance) == {
            ENKETO_BACKGROUND_AUDIO: None,
            'photo.jpg': None,
        }

    def test_collect_background_audio_is_kept(self):
        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid, background_audio=COLLECT_BACKGROUND_AUDIO
            ),
            [COLLECT_BACKGROUND_AUDIO],
        )

        assert self._delete_statuses(instance) == {COLLECT_BACKGROUND_AUDIO: None}

    def test_audit_file_is_kept(self):
        instance = self._submit(
            background_audio_submission_xml(self.version_uid, audit='audit.csv'),
            ['audit.csv'],
        )

        assert self._delete_statuses(instance) == {'audit.csv': None}

    def test_background_audio_is_kept_when_the_form_has_no_other_media_question(
        self,
    ):
        XForm.objects.filter(pk=self.xform.pk).update(
            xml=background_audio_xform_xml(with_photo=False)
        )

        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid,
                background_audio=ENKETO_BACKGROUND_AUDIO,
                audit='audit.csv',
            ),
            [ENKETO_BACKGROUND_AUDIO, 'audit.csv'],
        )

        assert self._delete_statuses(instance) == {
            ENKETO_BACKGROUND_AUDIO: None,
            'audit.csv': None,
        }

    def test_file_that_the_submission_does_not_reference_is_soft_deleted(self):
        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid, background_audio=ENKETO_BACKGROUND_AUDIO
            ),
            [ENKETO_BACKGROUND_AUDIO, 'stray.jpg'],
        )

        assert self._delete_statuses(instance) == {
            ENKETO_BACKGROUND_AUDIO: None,
            'stray.jpg': AttachmentDeleteStatus.SOFT_DELETED,
        }

    def test_replaced_background_audio_is_soft_deleted_on_edit(self):
        """
        A background audio file is matched against its question like any other
        file, so an edit that replaces it retires the previous one.
        """

        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid, background_audio=COLLECT_BACKGROUND_AUDIO
            ),
            [COLLECT_BACKGROUND_AUDIO],
        )

        new_background_audio = '1731761000000.m4a'
        xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
        edit_submission_xml(xml_parsed, BACKGROUND_AUDIO_QUESTION, new_background_audio)
        self._edit(instance, xml_parsed, [new_background_audio])

        assert self._delete_statuses(instance) == {
            COLLECT_BACKGROUND_AUDIO: AttachmentDeleteStatus.SOFT_DELETED,
            new_background_audio: None,
        }

    def test_stale_submission_keeps_a_background_audio_removed_since(self):
        """
        The submission was collected with a version that the deployed form no
        longer matches. The deployed XForm knows nothing of the background audio
        question, the version that the submission names does.
        """

        self._redeploy(with_background_audio=False)

        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid, background_audio=ENKETO_BACKGROUND_AUDIO
            ),
            [ENKETO_BACKGROUND_AUDIO],
        )

        assert self._delete_statuses(instance) == {ENKETO_BACKGROUND_AUDIO: None}

    def test_stale_submission_keeps_an_audit_removed_since(self):
        self._redeploy(with_audit=False)

        instance = self._submit(
            background_audio_submission_xml(self.version_uid, audit='audit.csv'),
            ['audit.csv'],
        )

        assert self._delete_statuses(instance) == {'audit.csv': None}

    def test_edit_keeps_the_files_of_questions_removed_since(self):
        """
        The deployed version holds neither the background audio question nor
        the audit. An edit that replaces the photo leaves their files untouched.
        """

        instance = self._submit(
            background_audio_submission_xml(
                self.version_uid,
                background_audio=ENKETO_BACKGROUND_AUDIO,
                photo='first.jpg',
                audit='audit.csv',
            ),
            [ENKETO_BACKGROUND_AUDIO, 'first.jpg', 'audit.csv'],
        )
        self._redeploy(with_background_audio=False, with_audit=False)

        xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
        edit_submission_xml(xml_parsed, PHOTO_QUESTION, 'second.jpg')
        self._edit(instance, xml_parsed, ['second.jpg'])

        assert self._delete_statuses(instance) == {
            ENKETO_BACKGROUND_AUDIO: None,
            'audit.csv': None,
            'first.jpg': AttachmentDeleteStatus.SOFT_DELETED,
            'second.jpg': None,
        }

    def _delete_statuses(self, instance: Instance) -> dict:
        return dict(
            Attachment.all_objects.filter(instance=instance).values_list(
                'media_file_basename', 'delete_status'
            )
        )

    def _edit(self, instance: Instance, xml_parsed, filenames: list[str]) -> Instance:
        """
        Post `xml_parsed` back as an edit of `instance`, uploading `filenames`.
        """

        edit_submission_xml(xml_parsed, 'meta/deprecatedID', f'uuid:{instance.uuid}')
        edit_submission_xml(xml_parsed, 'meta/instanceID', f'uuid:{uuid.uuid4()}')

        return self._submit(xml_tostring(xml_parsed), filenames)

    def _redeploy(
        self, with_background_audio: bool = True, with_audit: bool = True
    ) -> str:
        """
        Redeploy the asset without the questions left out, and move the XForm
        onto the new version, the way a redeployment does.
        """

        removed_types = set()
        if not with_background_audio:
            removed_types.add('background-audio')
        if not with_audit:
            removed_types.add('audit')

        self.asset.content['survey'] = [
            row
            for row in self.asset.content['survey']
            if row['type'] not in removed_types
        ]
        self.asset.save()
        self.asset.deploy(backend='mock')
        version_uid = self.asset.latest_deployed_version_uid

        XForm.objects.filter(pk=self.xform.pk).update(
            xml=background_audio_xform_xml(
                with_background_audio=with_background_audio, with_audit=with_audit
            ),
            json=xform_json(version_uid, media_question=PHOTO_QUESTION),
        )

        return version_uid

    def _submit(self, xml: str, filenames: list[str]) -> Instance:
        return create_instance(
            self.user.username,
            io.BytesIO(xml.encode()),
            media_files=[
                SimpleUploadedFile(filename, filename.encode())
                for filename in filenames
            ],
            request=self.request,
            check_usage_limits=False,
        )
