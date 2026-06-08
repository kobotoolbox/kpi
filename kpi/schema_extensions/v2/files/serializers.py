from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUrlField,
    ContentURlField,
    FileUrlField,
    MetadataCreateField,
    MetadataField,
    UserUrlField,
)

# Separate serializers for each upload method to avoid union type complexity
CreateFilePayloadBinary = inline_serializer_class(
    name='CreateFilePayloadBinary',
    fields={
        'user': UserUrlField(),
        'asset': AssetUrlField(),
        'description': serializers.CharField(),
        'file_type': serializers.CharField(),
        'content': serializers.CharField(),
    },
)

CreateFilePayloadBase64 = inline_serializer_class(
    name='CreateFilePayloadBase64',
    fields={
        'user': UserUrlField(),
        'asset': AssetUrlField(),
        'description': serializers.CharField(),
        'file_type': serializers.CharField(),
        'base64Encoded': serializers.CharField(),
        'metadata': MetadataCreateField(required=True),
    },
)

CreateFilePayloadURL = inline_serializer_class(
    name='CreateFilePayloadURL',
    fields={
        'user': UserUrlField(),
        'asset': AssetUrlField(),
        'description': serializers.CharField(),
        'file_type': serializers.CharField(),
        'metadata': MetadataCreateField(required=True),
    },
)

# Use PolymorphicProxySerializer to generate a discriminated union in OpenAPI
CreateFilePayload = PolymorphicProxySerializer(
    component_name='CreateFilePayload',
    serializers=[
        CreateFilePayloadBinary,
        CreateFilePayloadBase64,
        CreateFilePayloadURL,
    ],
    resource_type_field_name=None,  # No explicit discriminator field
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
