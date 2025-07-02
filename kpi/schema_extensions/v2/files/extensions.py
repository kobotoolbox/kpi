from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import ASSET_URL, BASE64_METADATA, FILE_URL, URL_METADATA, USER_URL


class AssetUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.AssetUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL


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
                        'user': USER_URL,
                        'asset': ASSET_URL,
                        'description': build_basic_type(OpenApiTypes.STR),
                        'file_type': build_basic_type(OpenApiTypes.STR),
                        'content': build_basic_type(OpenApiTypes.STR),
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
                        'user': USER_URL,
                        'asset': ASSET_URL,
                        'description': build_basic_type(OpenApiTypes.STR),
                        'file_type': build_basic_type(OpenApiTypes.STR),
                        'base64Encoded': build_basic_type(OpenApiTypes.STR),
                        'metadata': BASE64_METADATA,
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
                        'user': USER_URL,
                        'asset': ASSET_URL,
                        'description': build_basic_type(OpenApiTypes.STR),
                        'file_type': build_basic_type(OpenApiTypes.STR),
                        'metadata': URL_METADATA,
                    },
                ),
            ]
        }


class FileUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.FileUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return FILE_URL


class MetadataCreateFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.MetadataCreateField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(properties={})


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.MetadataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'hash': build_basic_type(OpenApiTypes.STR),
                'filename': build_basic_type(OpenApiTypes.STR),
                'mimetype': build_basic_type(OpenApiTypes.STR),
            }
        )


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.UserUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL
