from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import AssetSubscriptionAssetURLField, AssetSubscriptionURLField

AssetSubscriptionRequest = inline_serializer_class(
    name='AssetSubscriptionRequest',
    fields={
        'asset': AssetSubscriptionAssetURLField(),
    },
)


AssetSubscriptionResponse = inline_serializer_class(
    name='AssetSubscriptionResponse',
    fields={
        'url': AssetSubscriptionURLField(),
        'asset': AssetSubscriptionAssetURLField(),
        'uid': serializers.CharField(),
    },
)
