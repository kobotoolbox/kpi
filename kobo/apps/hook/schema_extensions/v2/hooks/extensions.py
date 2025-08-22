from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_object_type,
)

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_ARRAY_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


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
        return GENERIC_ARRAY_SCHEMA


class SettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.SettingsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'password': GENERIC_STRING_SCHEMA,
                'username': GENERIC_STRING_SCHEMA,
                'custom_headers': build_object_type(
                    properties={
                        'value_field': GENERIC_STRING_SCHEMA,
                        'value_field_2': GENERIC_STRING_SCHEMA,
                    }
                ),
            }
        )


class SubsetFieldsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.hook.schema_extensions.v2.hooks.fields.SubsetFieldsField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA
