from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class CreatePayloadFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.CreatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
                'group_sep': GENERIC_STRING_SCHEMA,
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'lang': build_basic_type(OpenApiTypes.BOOL),
                'multiple_select': GENERIC_STRING_SCHEMA,
                'types': GENERIC_STRING_SCHEMA,
                'fields': GENERIC_ARRAY_SCHEMA,
                'flatten': build_basic_type(OpenApiTypes.BOOL),
                'xls_types_as_text': build_basic_type(OpenApiTypes.BOOL),
                'include_media_url': build_basic_type(OpenApiTypes.BOOL),
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'query': build_object_type(
                    properties={
                        '$and': build_array_type(
                            schema=build_object_type(
                                properties={
                                    '_submission_time': build_object_type(
                                        properties={
                                            '$gte': build_basic_type(OpenApiTypes.DATE)
                                        }
                                    )
                                }
                            )
                        )
                    }
                ),
            }
        )


class DataUrlCSVFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.DataUrlCSVField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail-format',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
            format='csv',
        )


class DataUrlXLSXFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.DataUrlXLSXField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail-format',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
            format='xlsx',
        )


class ExportSettingsFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.ExportSettingsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'lang': GENERIC_STRING_SCHEMA,
                'type': GENERIC_STRING_SCHEMA,
                'fields': GENERIC_ARRAY_SCHEMA,
                'group_sep': GENERIC_STRING_SCHEMA,
                'multiple_select': GENERIC_STRING_SCHEMA,
                'include_media_url': build_basic_type(OpenApiTypes.BOOL),
                'xls_types_as_text': build_basic_type(OpenApiTypes.BOOL),
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
            }
        )


class UpdatePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.UpdatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
                'group_sep': GENERIC_STRING_SCHEMA,
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'lang': GENERIC_STRING_SCHEMA,
                'multiple_select': GENERIC_STRING_SCHEMA,
                'type': GENERIC_STRING_SCHEMA,
                'fields': GENERIC_ARRAY_SCHEMA,
            }
        )


class UrlFieldFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
        )
