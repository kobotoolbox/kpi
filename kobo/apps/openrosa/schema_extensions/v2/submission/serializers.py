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

# Lightweight variant used for error/status responses that only carry a message
# (e.g. 202 duplicate, 409 conflict) — no submissionMetadata field.
OpenRosaMessageResponse = inline_serializer_class(
    name='OpenRosaMessageResponse',
    fields={
        'message': serializers.CharField(),
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


JSONSubmissionPayload = inline_serializer_class(
    name='JSONSubmissionPayload',
    fields={
        'id': serializers.CharField(help_text='XForm ID String'),
        'submission': serializers.DictField(
            child=serializers.JSONField(),
            help_text='The JSON submission data',
        ),
    },
)
