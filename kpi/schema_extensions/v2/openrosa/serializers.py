from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    OpenRosaFileRequestField,
    OpenRosaFormHubField,
    OpenRosaManifestURLField,
    OpenRosaMetaField,
    OpenRosaXFormField,
)

OpenRosaFormListResponse = inline_serializer(
    name='OpenRosaFormListResponse',
    fields={
        'xform': OpenRosaXFormField(),
    },
)


OpenRosaManifestResponse = inline_serializer(
    name='OpenRosaManifestResponse',
    fields={
        'manifest': OpenRosaManifestURLField(),
    },
)


OpenRosaSubmissionResponse = inline_serializer(
    name='OpenRosaSubmissionResponse',
    fields={
        'question': serializers.CharField(),
        'meta': OpenRosaMetaField(),
        'formhub': OpenRosaFormHubField(),
    },
)


OpenRosaSubmissionRequest = inline_serializer(
    name='OpenRosaSubmissionRequest',
    fields={
        'xml_submission_file': serializers.FileField(),
    },
)


OpenRosaXFormResponse = inline_serializer(
    name='OpenRosaXFormResponse',
    fields={
        'html': OpenRosaFileRequestField(),
    },
)
