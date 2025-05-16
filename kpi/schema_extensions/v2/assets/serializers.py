from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetSettingsField,
    AssetCloneField,
)

AssetCreateRequest = inline_serializer_class(
    name='AssetCreateRequest',
    fields={
        'name': serializers.CharField(),
        'clone_from': AssetCloneField(),
        'settings': AssetSettingsField(),
        'asset_type': serializers.CharField(),
    },
)
