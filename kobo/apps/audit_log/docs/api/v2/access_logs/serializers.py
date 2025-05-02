from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import AccessLogMetadataField

# Inline serializers are created to actually give the right fields that are
# received and/or given in a payload when the schema generates the wrong
# attributes.
AccessLogExportCreateInlineSerializer = inline_serializer(
    name='AccessLogExportCreateInlineSerializer',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)

# AccessLogMetadataField is in references to a JSON object. Since the schema generation
# has a problem with generating JSON object (instead putting strings), we need to use
# an external class that will be called by a schema util (kpi.utils.docs.schema.py)
AccessLogListInlineSerializer = inline_serializer(
    name='AccessLogsListInlineSerializer',
    fields={
        'user': serializers.URLField(),
        'date_created': serializers.DateTimeField(),
        'username': serializers.CharField(),
        'metadata': AccessLogMetadataField(),
        'user_uid': serializers.CharField(),
        'count': serializers.IntegerField(),
    }
)


AccessLogExportListInlineSerializer = inline_serializer(
    name='AccessLogExportListInlineSerializer',
    fields={
        'uid': serializers.CharField(max_length=24),
        'status': serializers.CharField(max_length=32),
        'date_created': serializers.DateTimeField(),
    },
)
