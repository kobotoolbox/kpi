from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import SubmissionMetadataField

OpenRosaResponse = inline_serializer_class(
    name='OpenRosaResponse',
    fields={
        'message': serializers.CharField(),
        'submissionMetadata': SubmissionMetadataField(),
    },
)


OpenRosaPayload = inline_serializer_class(
    name='OpenRosaPayload',
    fields={
        'xml_submission_file': serializers.CharField(),
    },
)
