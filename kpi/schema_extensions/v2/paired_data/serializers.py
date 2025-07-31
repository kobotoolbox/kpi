from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

# from kpi.schema_extensions.v2.assets.schema import ASSET_URL_SCHEMA
from .fields import DataField, FieldFields, SourceField, SourceNameField, URLField

ExternalResponse = inline_serializer_class(
    name='ExternalResponse',
    fields={
        'root': DataField(),
    },
)


PairedDataResponse = inline_serializer_class(
    name='PairedDataResponse',
    fields={
        'source': SourceField(),
        'source__name': SourceNameField(),
        'fields': FieldFields(),
        'filename': serializers.CharField(),
        'url': URLField(),
    },
)


PairedDataPatchPayload = inline_serializer_class(
    name='PairedDataPatchPayload',
    fields={
        'fields': FieldFields(),
        'filename': serializers.CharField(),
    },
)
