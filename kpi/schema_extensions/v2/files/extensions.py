from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import (
    BASE64_METADATA_SCHEMA,
    FILE_URL_SCHEMA,
    URL_METADATA_SCHEMA,
)
from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    USER_URL_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)


class AssetUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.AssetUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class ContentURlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.ContentURlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-file-content',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='afSa8PqnoYe8vJqkrsGz3oN',
        )


class FileCreateRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.files.serializers.CreateFilePayload'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'user',
                        'asset',
                        'description',
                        'file_type',
                        'content',
                    ],
                    properties={
                        'user': USER_URL_SCHEMA,
                        'asset': ASSET_URL_SCHEMA,
                        'description': GENERIC_STRING_SCHEMA,
                        'file_type': GENERIC_STRING_SCHEMA,
                        'content': GENERIC_STRING_SCHEMA,
                    },
                ),
                build_object_type(
                    required=[
                        'user',
                        'asset',
                        'description',
                        'file_type',
                        'base64Encoded',
                        'metadata',
                    ],
                    properties={
                        'user': USER_URL_SCHEMA,
                        'asset': ASSET_URL_SCHEMA,
                        'description': GENERIC_STRING_SCHEMA,
                        'file_type': GENERIC_STRING_SCHEMA,
                        'base64Encoded': GENERIC_STRING_SCHEMA,
                        'metadata': BASE64_METADATA_SCHEMA,
                    },
                ),
                build_object_type(
                    required=[
                        'user',
                        'asset',
                        'description',
                        'file_type',
                        'metadata',
                    ],
                    properties={
                        'user': USER_URL_SCHEMA,
                        'asset': ASSET_URL_SCHEMA,
                        'description': GENERIC_STRING_SCHEMA,
                        'file_type': GENERIC_STRING_SCHEMA,
                        'metadata': URL_METADATA_SCHEMA,
                    },
                ),
            ]
        }


class FileUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.FileUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return FILE_URL_SCHEMA


class MetadataCreateFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.MetadataCreateField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.MetadataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'hash': GENERIC_STRING_SCHEMA,
                'filename': GENERIC_STRING_SCHEMA,
                'mimetype': GENERIC_STRING_SCHEMA,
            }
        )


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.UserUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
