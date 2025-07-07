from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    FieldFields,
    SourceField,
    SourceNameField,
    URLField
)

from kpi.constants import (
    ASSET_TYPE_SURVEY,
)

from kpi.models import Asset

PairedDataResponse = inline_serializer_class(
    name='PairedDataResponse',
    fields={
        'source': SourceField(
            lookup_field='uid',
            queryset=Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY),
            view_name='asset-detail',
            required=True,
            style={'base_template': 'input.html'}
        ),
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
