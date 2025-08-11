from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    OpenRosaFileRequestField,
    OpenRosaFormHubField,
    OpenRosaManifestURLField,
    OpenRosaMetaField,
)

OpenRosaFormListResponse = inline_serializer_class(
    name='OpenRosaFormListResponse',
    fields={
        'formID': serializers.CharField(),
        'name': serializers.CharField(),
        'majorMinorVersion': serializers.CharField(),
        'version': serializers.CharField(),
        'hash': serializers.CharField(),
        'description': serializers.CharField(),
        'downloadUrl': serializers.URLField(),
        'manifestUrl': serializers.URLField(),
    },
)


OpenRosaManifestResponse = inline_serializer_class(
    name='OpenRosaManifestResponse',
    fields={
        'manifest': OpenRosaManifestURLField(),
    },
)


OpenRosaSubmissionResponse = inline_serializer_class(
    name='OpenRosaSubmissionResponse',
    fields={
        'question': serializers.CharField(),
        'meta': OpenRosaMetaField(),
        'formhub': OpenRosaFormHubField(),
    },
)


OpenRosaSubmissionRequest = inline_serializer_class(
    name='OpenRosaSubmissionRequest',
    fields={
        'xml_submission_file': serializers.FileField(),
    },
)


OpenRosaXFormResponse = inline_serializer_class(
    name='OpenRosaXFormResponse',
    fields={
        'html': OpenRosaFileRequestField(),
    },
)
