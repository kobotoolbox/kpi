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


SubmissionResponse = inline_serializer_class(
    name='SubmissionResponse',
    fields={
        'message': serializers.CharField(),
        'formid': serializers.CharField(),
        'encrypted': serializers.BooleanField(),
        'instanceID': serializers.CharField(),
        'submissionDate': serializers.DateTimeField(),
        'markedAsCompleteDate': serializers.DateTimeField(),
    },
)


OpenRosaPayload = inline_serializer_class(
    name='OpenRosaPayload',
    fields={
        'xml_submission_file': serializers.FileField(),
    },
)


JSONSubmissionPayload = inline_serializer_class(
    name='JSONSubmissionPayload',
    fields={
        'id': serializers.CharField(help_text='XForm ID String'),
        'submission': serializers.JSONField(help_text='The JSON submission data'),
    },
)
