from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import AssetListField, ParentUrlField, TagUrlField

TagListResponse = inline_serializer_class(
    name='TagListResponse',
    fields={
        'name': serializers.CharField(),
        'url': TagUrlField(),
    },
)


TagRetrieveResponse = inline_serializer_class(
    name='TagRetrieveResponse',
    fields={
        'name': serializers.CharField(),
        'url': TagUrlField(),
        'assets': AssetListField(),
        'parent': ParentUrlField(),
        'uid': serializers.CharField(),
    },
)
