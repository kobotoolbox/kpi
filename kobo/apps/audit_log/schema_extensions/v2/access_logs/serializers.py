from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import AccessLogMetadataField, AccessLogUserURLField

# Inline serializers are created to actually give the right fields that are
# received and/or given in a payload when the schema generates the wrong
# attributes.
ExportCreateResponse = inline_serializer_class(
    name='ExportCreateResponse',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)

# AccessLogMetadataField is in references to a JSON object. Since the schema generation
# has a problem with generating JSON object (instead putting strings), we need to use
# an external class that will be called by a schema util
AccessLogResponse = inline_serializer_class(
    name='AccessLogResponse',
    fields={
        'user': AccessLogUserURLField(),
        'date_created': serializers.DateTimeField(),
        'username': serializers.CharField(),
        'metadata': AccessLogMetadataField(),
        'user_uid': serializers.CharField(),
        'count': serializers.IntegerField(),
    },
)


ExportListResponse = inline_serializer_class(
    name='ExportListResponse',
    fields={
        'uid': serializers.CharField(max_length=24),
        'status': serializers.CharField(max_length=32),
        'date_created': serializers.DateTimeField(),
    },
)
