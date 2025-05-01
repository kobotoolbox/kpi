from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

AccessLogCreateInlineSerializer = inline_serializer(
    name='AccessLogCreateInlineSerializer',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)

AccessLogListExportInlineSerializer = inline_serializer(
    name='AccessLogListExportInlineSerializer',
    fields={
        'uid': serializers.CharField(max_length=24),
        'status': serializers.CharField(max_length=32),
        'date_create': serializers.DateTimeField(),
    },
)
