from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    AssetSnapshotCreateDetailsField,
    AssetSnapshotDetailsField,
    AssetSnapshotSourceField,
    AssetSnapshotURLField,
    AssetSnapshotUserURLField,
    AssetSnapshotPreviewURLField,
    AssetSnapshotXMLURLField,
)

AssetSnapshotCreateRequest = inline_serializer(
    name='AssetSnapshotCreateRequest',
    fields={
        'asset': AssetSnapshotURLField(allow_null=True, required=False),
        'details': AssetSnapshotCreateDetailsField(allow_null=True, required=False),
        'source': AssetSnapshotSourceField(allow_null=True, required=False),
    },
)

AssetSnapshotResponse = inline_serializer(
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
