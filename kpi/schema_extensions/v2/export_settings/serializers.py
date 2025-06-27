from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    CreatePayloadField,
    ExportSettingsField,
    DataUrlCSVField,
    DataUrlXLSXField,
    UrlField,
    UpdatePayloadField
)


ExportSettingCreatePayload = inline_serializer_class(
    name='ExportSettingCreatePayload',
    fields={
        'name': serializers.CharField(),
        'export_settings': CreatePayloadField(),
    }
)

ExportSettingResponse = inline_serializer_class(
    name='ExportSettingResponse',
    fields={
        'uid': serializers.CharField(),
        'url': UrlField(),
        'data_url_csv': DataUrlCSVField(),
        'data_url_xlsx': DataUrlXLSXField(),
        'name': serializers.CharField(),
        'date_modified': serializers.TimeField(),
        'export_settings': ExportSettingsField(),
    },
)

ExportSettingUpdatePayload = inline_serializer_class(
    name='ExportSettingUpdatePayload',
    fields={
        'name': serializers.CharField(),
        'export_settings': UpdatePayloadField()
    }
)
