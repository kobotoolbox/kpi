# coding: utf-8
import json
import os
from mimetypes import guess_type
from tempfile import NamedTemporaryFile
from typing import Optional
from urllib.parse import parse_qs, unquote

from django.conf import settings
from django.core.files import File
from rest_framework import status

from kpi.mixins.mp3_converter import MP3ConverterMixin


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


class MockAttachment(MP3ConverterMixin):
    """
    Mock object to simulate ReadOnlyKobocatAttachment.
    Relationship with ReadOnlyKobocatInstance is ignored but could be implemented
    """
    def __init__(self, pk: int, filename: str, mimetype: str = None, **kwargs):

        self.id = pk  # To mimic Django model instances
        self.pk = pk
        basename = os.path.basename(filename)
        file_ = os.path.join(
            settings.BASE_DIR,
            'kpi',
            'tests',
            basename
        )

        self.media_file = File(open(file_, 'rb'), basename)
        self.media_file.path = file_
        self.content = self.media_file.read()
        self.media_file_basename = basename
        if not mimetype:
            self.mimetype, _ = guess_type(file_)
        else:
            self.mimetype = mimetype

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.media_file.close()

    @property
    def absolute_path(self):
        return self.media_file.path

    def protected_path(self, format_: Optional[str] = None):
        if format_ == self.CONVERSION_AUDIO_FORMAT:
            suffix = f'.{self.CONVERSION_AUDIO_FORMAT}'
            with NamedTemporaryFile(suffix=suffix) as f:
                self.content = self.get_mp3_content()
            return f.name
        else:
            return self.absolute_path
