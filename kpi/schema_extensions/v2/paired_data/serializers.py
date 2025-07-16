from rest_framework import serializers

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset
from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import DataField, FieldFields, SourceField, SourceNameField, URLField
# from kpi.schema_extensions.v2.assets.schema import ASSET_URL_SCHEMA
from kpi.utils.schema_extensions.url_builder import build_url_type


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
