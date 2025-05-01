from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

AccessLogExportCreateInlineSerializer = inline_serializer(
    name='AccessLogExportCreateInlineSerializer',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)

AccessLogExportListInlineSerializer = inline_serializer(
    name='AccessLogExportListInlineSerializer',
    fields={
        'uid': serializers.CharField(max_length=24),
        'status': serializers.CharField(max_length=32),
        'date_created': serializers.DateTimeField(),
    },
)
