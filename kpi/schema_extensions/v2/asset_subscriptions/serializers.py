from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import AssetSubscriptionURLField
from ..assets.fields import AssetURLField

AssetSubscriptionRequest = inline_serializer_class(
    name='AssetSubscriptionRequest',
    fields={
        'asset': AssetURLField(),
    },
)


AssetSubscriptionResponse = inline_serializer_class(
    name='AssetSubscriptionResponse',
    fields={
        'url': AssetSubscriptionURLField(),
        'asset': AssetURLField(),
        'uid': serializers.CharField(),
    },
)
