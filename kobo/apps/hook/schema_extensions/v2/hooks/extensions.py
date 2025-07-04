from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-detail', uid='a3C9wWefqZVkChNLKqqXVZ')


class LogsUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.LogsUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:hook-log-list',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            parent_lookup_hook='hZzzeedWxQoFHgibsTCysv',
        )


class PendingUidsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.PendingUidsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.STR))


class SettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.SettingsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'password': build_basic_type(OpenApiTypes.STR),
                'username': build_basic_type(OpenApiTypes.STR),
                'custom_headers': build_object_type(
                    properties={
                        'value_field': build_basic_type(OpenApiTypes.STR),
                        'value_field_2': build_basic_type(OpenApiTypes.STR),
                    }
                ),
            }
        )


class SubsetFieldsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.SubsetFieldsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.STR))
