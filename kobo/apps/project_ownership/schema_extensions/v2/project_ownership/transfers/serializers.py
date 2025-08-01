from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUrlField,
    StatusesField,
    TransferUrlField,
)


TransferListResponse = inline_serializer_class(
    name='TransferListResponse',
    fields={
        'url': TransferUrlField(),
        'asset': AssetUrlField(),
        'status': serializers.CharField(),
        'error': serializers.CharField(),
        'date_modified': serializers.DateTimeField(),
        'statuses': StatusesField(),
    },
)
