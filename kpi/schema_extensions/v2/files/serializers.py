from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUrlField,
    ContentURlField,
    FileUrlField,
    MetadataField,
    UserUrlField,
)

filesResponse = inline_serializer_class(
    name='filesResponse',
    fields={
        'uid': serializers.CharField(),
        'url': FileUrlField(),
        'asset': AssetUrlField(),
        'user': UserUrlField(),
        'user__username': serializers.CharField(),
        'file_type': serializers.CharField(),
        'description': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
        'content': ContentURlField(),
        'metadata': MetadataField(),
    },
)
