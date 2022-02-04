# coding: utf-8
import json
import os
from mimetypes import guess_type

from django.conf import settings
from django.core.files import File
from rest_framework import status


def enketo_edit_instance_response(request):
    """
    Simulate Enketo response
    """
    body = json.loads(request.body)
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
    body = json.loads(request.body)
    resp_body = {
        'view_url': (
            f"{settings.ENKETO_URL}/view/{body['instance_id']}"
        )
    }
    headers = {}
    return status.HTTP_201_CREATED, headers, json.dumps(resp_body)


class MockAttachment:
    """
    Mock object to simulate ReadOnlyKobocatAttachment.
    Relationship with ReadOnlyKobocatInstance is ignored but could be implemented
    """
    def __init__(self, id: int, filename: str, mimetype: str = None, **kwargs):

        self.id = id
        basename = os.path.basename(filename)
        file_ = os.path.join(
            settings.BASE_DIR,
            'kpi',
            'tests',
            basename
        )
        self.pk = id
        self.id = id
        self.media_file = File(open(file_, 'rb'), basename)
        self.media_file.path = file_
        self.media_file_basename = basename
        if not mimetype:
            self.mimetype, _ = guess_type(file_)
        else:
            self.mimetype = mimetype

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.media_file.close()
