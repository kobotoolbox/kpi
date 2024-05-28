# coding: utf-8
import json
import lxml
import os
from mimetypes import guess_type
from tempfile import NamedTemporaryFile
from typing import Optional
from urllib.parse import parse_qs, unquote

from django.conf import settings
from django.core.files import File
from django.core.files.storage import default_storage
from rest_framework import status

from kobo.apps.openrosa.libs.utils.image_tools import (
    get_optimized_image_path,
    resize,
)
from kpi.mixins.audio_transcoding import AudioTranscodingMixin
from kpi.models.asset_snapshot import AssetSnapshot
from kpi.tests.utils.xml import get_form_and_submission_tag_names


def enketo_edit_instance_response(request):
    """
    Simulate Enketo response
    """
    # Decode `x-www-form-urlencoded` data
    body = {k: v[0] for k, v in parse_qs(unquote(request.body)).items()}

    resp_body = {
        'edit_url': (
            f"{settings.ENKETO_URL}/edit/{body['instance_id']}"
        )
    }
    headers = {}
    return status.HTTP_201_CREATED, headers, json.dumps(resp_body)


def enketo_edit_instance_response_with_root_name_validation(request):
    """
    Simulate Enketo response and validate root names
    """
    # Decode `x-www-form-urlencoded` data
    body = {k: v[0] for k, v in parse_qs(unquote(request.body)).items()}

    submission = body['instance']
    snapshot = AssetSnapshot.objects.get(uid=body['form_id'])

    (
        form_root_name,
        submission_root_name,
    ) = get_form_and_submission_tag_names(snapshot.xml, submission)

    assert form_root_name == submission_root_name

    resp_body = {
        'edit_url': (
            f"{settings.ENKETO_URL}/edit/{body['instance_id']}"
        )
    }
    headers = {}
    return status.HTTP_201_CREATED, headers, json.dumps(resp_body)


def enketo_edit_instance_response_with_uuid_validation(request):
    """
    Simulate Enketo response and validate that formhub/uuid and meta/instanceID
    are present and non-empty
    """
    # Decode `x-www-form-urlencoded` data
    body = {k: v[0] for k, v in parse_qs(unquote(request.body)).items()}

    submission = body['instance']
    submission_xml_root = lxml.etree.fromstring(submission)
    assert submission_xml_root.find(
        'formhub/uuid'
    ).text.strip()
    assert submission_xml_root.find(
        'meta/instanceID'
    ).text.strip()

    resp_body = {
        'edit_url': (
            f"{settings.ENKETO_URL}/edit/{body['instance_id']}"
        )
    }
    headers = {}
    return status.HTTP_201_CREATED, headers, json.dumps(resp_body)


def enketo_view_instance_response(request):
    """
    Simulate Enketo response
    """
    # Decode `x-www-form-urlencoded` data
    body = {k: v[0] for k, v in parse_qs(unquote(request.body)).items()}

    resp_body = {
        'view_url': (
            f"{settings.ENKETO_URL}/view/{body['instance_id']}"
        )
    }
    headers = {}
    return status.HTTP_201_CREATED, headers, json.dumps(resp_body)


class MockAttachment(AudioTranscodingMixin):
    """
    Mock object to simulate KobocatAttachment.
    Relationship with ReadOnlyKobocatInstance is ignored but could be implemented

    TODO Remove this class and use `Attachment` model everywhere in tests
    """
    def __init__(self, pk: int, filename: str, mimetype: str = None, **kwargs):

        self.id = pk  # To mimic Django model instances
        self.pk = pk

        # Unit test `test_thumbnail_creation_on_demand()` is using real `Attachment`
        # objects while other tests are using `MockAttachment` objects.
        # If an Attachment object exists, let's assume unit test is using real
        # Attachment objects. Otherwise, use MockAttachment.
        from kobo.apps.openrosa.apps.logger.models import Attachment  # Avoid circular import

        attachment_object = Attachment.objects.filter(pk=pk).first()
        if attachment_object:
            self.media_file = attachment_object.media_file
            self.media_file_size = attachment_object.media_file_size
            self.media_file_basename = attachment_object.media_file_basename
        else:
            basename = os.path.basename(filename)
            file_ = os.path.join(
                settings.BASE_DIR,
                'kpi',
                'tests',
                basename
            )
            self.media_file = File(open(file_, 'rb'), basename)
            self.media_file.path = file_
            self.media_file_size = os.path.getsize(file_)
            self.media_file_basename = basename

        self.content = self.media_file.read()

        if not mimetype:
            self.mimetype, _ = guess_type(file_)
        else:
            self.mimetype = mimetype

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.media_file.close()

    @property
    def absolute_path(self):
        return self.media_file.path

    def protected_path(
        self, format_: Optional[str] = None, suffix: Optional[str] = None
    ) -> str:
        if format_ == 'mp3':
            extension = '.mp3'
            with NamedTemporaryFile(suffix=extension) as f:
                self.content = self.get_transcoded_audio(format_)
            return f.name
        else:
            if suffix and self.mimetype.startswith('image/'):
                optimized_image_path = get_optimized_image_path(
                    self.media_file.name, suffix
                )
                if not default_storage.exists(optimized_image_path):
                    resize(self.media_file.name)
                return default_storage.path(optimized_image_path)
            else:
                return self.absolute_path
