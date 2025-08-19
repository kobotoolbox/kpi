# coding: utf-8
import json
from mimetypes import guess_type
from urllib.parse import parse_qs, unquote

from django.conf import settings
from rest_framework import status

from kpi.models.asset_snapshot import AssetSnapshot
from kpi.tests.utils.xml import get_form_and_submission_tag_names
from kpi.utils.xml import fromstring_preserve_root_xmlns


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
    submission_xml_root = fromstring_preserve_root_xmlns(submission)
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


def guess_type_mock(url, strict=True):
    """
    In the container, `*.3gp` returns "audio/3gpp"  instead of "video/3gpp".
    """
    if url.endswith('.3gp'):
        return 'video/3gpp', None
    return guess_type(url, strict)
