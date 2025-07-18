from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import ExportResponseResult



ProjectViewExportCreateResponse = inline_serializer_class(
    name='ProjectViewExportResponse',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)


ProjectViewExportResponse = inline_serializer_class(
    name='ProjectViewExportResponse',
    fields={
        'status': serializers.CharField(max_length=32),
        'result': ExportResponseResult(),
    },
)
