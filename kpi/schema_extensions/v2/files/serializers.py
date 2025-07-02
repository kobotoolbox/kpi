from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUrlField,
    ContentURlField,
    FileUrlField,
    MetadataField,
    MetadataCreateField,
    UserUrlField,
)


CreateFilePayload = inline_serializer_class(
    name='CreateFilePayload',
    fields={
        'user': UserUrlField(),
        'asset': AssetUrlField(),
        'description': serializers.CharField(),
        'file_type': serializers.CharField(),
        'metadata': MetadataCreateField(),
        'base64Encoded': serializers.CharField(),
        'content': serializers.CharField(),
    }
)

FilesResponse = inline_serializer_class(
    name='FilesResponse',
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
