from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    AssetSnapshotCreateDetailsField,
    AssetSnapshotDetailsField,
    AssetSnapshotSourceField,
    AssetSnapshotURLField,
    AssetSnapshotURLPreviewField,
    AssetSnapshotURLUserField,
    AssetSnapshotURLXMLField,
)

AssetSnapshotCreateRequestInlineSerializer = inline_serializer(
    name='AssetSnapshotCreateRequestInlineSerializer',
    fields={
        'asset': AssetSnapshotURLField(allow_null=True, required=False),
        'details': AssetSnapshotCreateDetailsField(allow_null=True, required=False),
        'source': AssetSnapshotSourceField(allow_null=True, required=False),
    },
)

AssetSnapshotResultInlineSerializer = inline_serializer(
    name='AssetSnapshotResultInlineSerializer',
    fields={
        'url': AssetSnapshotURLField(),
        'uid': serializers.CharField(),
        'owner': AssetSnapshotURLUserField(),
        'date_created': serializers.DateTimeField(),
        'xml': AssetSnapshotURLXMLField(),
        'enketopreviewlink': AssetSnapshotURLPreviewField(),
        'asset': AssetSnapshotURLField(),
        'asset_version_id': serializers.IntegerField(),
        'details': AssetSnapshotDetailsField(),
        'source': AssetSnapshotSourceField(),
    },
)
