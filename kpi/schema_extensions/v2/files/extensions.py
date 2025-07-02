from drf_spectacular.extensions import (
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import (
    build_array_type,
    build_object_type,
    build_basic_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

class AssetUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.AssetUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-detail', uid='a3C9wWefqZVkChNLKqqXVZ')


class ContentURlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.ContentURlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-file-content',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='afSa8PqnoYe8vJqkrsGz3oN',
        )


class FileUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.FileUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-file-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='afSa8PqnoYe8vJqkrsGz3oN',
        )


class MetadataCreateFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.files.fields.MetadataCreateField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'filename': build_basic_type(OpenApiTypes.STR),
            }
        )


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
        return build_url_type('user-kpi-detail', username='bob')
