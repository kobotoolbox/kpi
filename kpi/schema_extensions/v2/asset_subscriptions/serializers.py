from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import AssetSubscriptionAssetURLField, AssetSubscriptionURLField


AssetSubscriptionPostRequestInlineSerializer = inline_serializer(
    name='AssetSubscriptionPostRequestInlineSerializer',
    fields={
        'asset': AssetSubscriptionAssetURLField(),
    },
)


AssetSubscriptionPostResponseInlineSerializer = inline_serializer(
    name='AssetSubscriptionPostResponseInlineSerializer',
    fields={
        'url': AssetSubscriptionURLField(),
        'asset': AssetSubscriptionAssetURLField(),
        'uid': serializers.CharField(),
    },
)
