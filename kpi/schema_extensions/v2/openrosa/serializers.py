from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


from .fields import (
    OpenRosaFormHubFields,
    OpenRosaMetaFields
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
        'source': serializers.CharField(),
    },
)

OpenRosaFormListInlineSerializer = inline_serializer(
    name='OpenRosaFormListInlineSerializer',
    fields={
        'formID': serializers.CharField(),
        'name': serializers.CharField(),
        'hash': serializers.CharField(),
        'descriptionText': serializers.CharField(),
        'downloadUrl': serializers.CharField(),
        'manifestUrl': serializers.CharField(),
    }
)
