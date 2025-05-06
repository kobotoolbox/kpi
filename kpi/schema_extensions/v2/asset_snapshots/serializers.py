from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    AssetSnapshotDetailsField,
    AssetSnapshotSourceField,
)

AssetSnapshotResultInlineSerializer = inline_serializer(
    name='AssetSnapshotResultInlineSerializer',
    fields={
        'url': serializers.URLField(),
        'uid': serializers.CharField(),
        'owner': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
        'xml': serializers.URLField(),
        'enketopreviewlink': serializers.URLField(),
        'asset': serializers.URLField(),
        'asset_version_id': serializers.IntegerField(),
        'details': AssetSnapshotDetailsField(),
        'source': AssetSnapshotSourceField(),
    }
)
