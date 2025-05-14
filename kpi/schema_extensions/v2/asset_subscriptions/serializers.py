from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import AssetSubscriptionAssetURLField, AssetSubscriptionURLField

AssetSubscriptionRequest = inline_serializer(
    name='AssetSubscriptionRequest',
    fields={
        'asset': AssetSubscriptionAssetURLField(),
    },
)


AssetSubscriptionResponse = inline_serializer(
    name='AssetSubscriptionResponse',
    fields={
        'url': AssetSubscriptionURLField(),
        'asset': AssetSubscriptionAssetURLField(),
        'uid': serializers.CharField(),
    },
)
