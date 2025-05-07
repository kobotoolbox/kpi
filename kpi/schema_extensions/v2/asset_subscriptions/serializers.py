from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

# from .fields import (
#     # AssetSnapshotCreateDetailsField,
# )


AssetSubscriptionPostRequestInlineSerializer = inline_serializer(
    name='AssetSubscriptionRequestInlineSerializer',
    fields={
        'url': serializers.CharField(),
        'asset': serializers.CharField(),
        'uid': serializers.CharField(),
    },
)
