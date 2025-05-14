from rest_framework import serializers

from kpi.utils.schema_extensions.inline_serializer_class import inline_serializer_class
from .fields import (
    AssetSnapshotCreateDetailsField,
    AssetSnapshotDetailsField,
    AssetSnapshotPreviewURLField,
    AssetSnapshotSourceField,
    AssetSnapshotURLField,
    AssetSnapshotUserURLField,
    AssetSnapshotXMLURLField,
)

AssetSnapshotCreateRequest = inline_serializer_class(
    name='AssetSnapshotCreateRequest',
    fields={
        'asset': AssetSnapshotURLField(allow_null=True, required=False),
        'details': AssetSnapshotCreateDetailsField(allow_null=True, required=False),
        'source': AssetSnapshotSourceField(allow_null=True, required=False),
    },
)

AssetSnapshotResponse = inline_serializer_class(
    name='AssetSnapshotResponse',
    fields={
        'url': AssetSnapshotURLField(),
        'uid': serializers.CharField(),
        'owner': AssetSnapshotUserURLField(),
        'date_created': serializers.DateTimeField(),
        'xml': AssetSnapshotXMLURLField(),
        'enketopreviewlink': AssetSnapshotPreviewURLField(),
        'asset': AssetSnapshotURLField(),
        'asset_version_id': serializers.CharField(),
        'details': AssetSnapshotDetailsField(),
        'source': AssetSnapshotSourceField(),
    },
)
