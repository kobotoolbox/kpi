from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    OpenRosaFileRequestField,
    OpenRosaFormHubField,
    OpenRosaMetaField,
    OpenRosaXFormField,
)

OpenRosaFormListInlineSerializer = inline_serializer(
    name='OpenRosaFormListInlineSerializer',
    fields={
        'xform': OpenRosaXFormField(),
    },
)


OpenRosaManifestInlineSerializer = inline_serializer(
    name='OpenRosaManifestInlineSerializer',
    fields={
        'manifest': serializers.URLField(),
    },
)


OpenRosaSubmissionInlineSerializer = inline_serializer(
    name='OpenRosaSubmissionInlineSerializer',
    fields={
        'question': serializers.URLField(),
        'meta': OpenRosaMetaField(),
        'formhub': OpenRosaFormHubField(),
    },
)


OpenRosaSubmissionRequestInlineSerializer = inline_serializer(
    name='OpenRosaSubmissionRequestInlineSerializer',
    fields={
        'xml_submission_file': serializers.FileField(),
    },
)


OpenRosaXFormActionInlineSerializer = inline_serializer(
    name='OpenRosaXFormActionInlineSerializer',
    fields={
        'html': OpenRosaFileRequestField(),
    },
)
