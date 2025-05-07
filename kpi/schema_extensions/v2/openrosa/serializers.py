from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


from .fields import (
    OpenRosaFormHubFields,
    OpenRosaMetaFields,
    OpenRosaXFormFields,
    OpenRosaXFileRequestFields,
)

OpenRosaSubmissionInlineSerializer = inline_serializer(
    name='OpenRosaSubmissionInlineSerializer',
    fields={
        'question': serializers.URLField(),
        'meta': OpenRosaMetaFields(),
        'formhub': OpenRosaFormHubFields(),
    },
)


OpenRosaSubmissionPayloadInlineSerializer = inline_serializer(
    name='OpenRosaSubmissionPayloadInlineSerializer',
    fields={
        'xml_submission_file': serializers.FileField(),
    },
)

OpenRosaFormListInlineSerializer = inline_serializer(
    name='OpenRosaFormListInlineSerializer',
    fields={
        'xform': OpenRosaXFormFields(),
    }
)

OpenRosaManifestInlineSerializer = inline_serializer(
    name='OpenRosaManifestInlineSerializer',
    fields={
        'manifest': serializers.URLField(),
    }
)


OpenRosaPreviewURLInlineSerializer = inline_serializer(
    name='OpenRosaPreviewURLInlineSerializer',
    fields={
        'url': serializers.URLField(),
    }
)

OpenRosaXFormActionInlineSerializer = inline_serializer(
    name='OpenRosaXFormActionInlineSerializer',
    fields={
        'html': OpenRosaXFileRequestFields(),
        'test2': serializers.CharField(),
    }
)
