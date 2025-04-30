from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

AccessLogMeCreateInlineSerializer = inline_serializer(
    name='AccessLogMeCreateInlineSerializer',
    fields={
        'status': serializers.CharField(max_length=32),
    }
)
