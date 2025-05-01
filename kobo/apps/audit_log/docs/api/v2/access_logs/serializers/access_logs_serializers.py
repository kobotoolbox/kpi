from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

AccessLogMeCreateInlineSerializer = inline_serializer(
    name='AccessLogMeCreateInlineSerializer',
    fields={
        'status': serializers.CharField(max_length=32),
    }
)

AccessLogListExportSerializer = inline_serializer(
    name='AccessLogListExportSerializer',
    fields={
        'uid': serializers.CharField(max_length=24),
        'status': serializers.CharField(max_length=32),
        'date_create': serializers.DateTimeField(),
    }
)
