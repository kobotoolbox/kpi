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

from kobo.apps.openrosa.apps.logger.models.attachment import (
    Attachment,
    upload_to,
)
from kobo.apps.openrosa.libs.utils.image_tools import (
    get_optimized_image_path,
    resize,
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage,
    KobocatFileSystemStorage,
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
