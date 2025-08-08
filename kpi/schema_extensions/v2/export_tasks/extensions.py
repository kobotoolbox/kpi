from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_ARRAY_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class DataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.DataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'lang': GENERIC_STRING_SCHEMA,
                'name': GENERIC_STRING_SCHEMA,
                'type': GENERIC_STRING_SCHEMA,
                'fields': GENERIC_ARRAY_SCHEMA,
                'source': ASSET_URL_SCHEMA,
                'group_sep': GENERIC_STRING_SCHEMA,
                'multiple_select': GENERIC_STRING_SCHEMA,
                'include_media_url': build_basic_type(OpenApiTypes.BOOL),
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'processing_time_seconds': build_basic_type(OpenApiTypes.FLOAT),
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
            }
        )


class FieldsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.FieldsField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class MessageFieldExtend(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.MessageField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class QueryFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.QueryField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                '$and': build_array_type(
                    schema=build_object_type(
                        properties={
                            '_submission_time': build_object_type(
                                properties={
                                    '$gte': build_basic_type(OpenApiTypes.DATE),
                                }
                            )
                        }
                    )
                ),
            }
        )


class ResultFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.ResultField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'serve_private_file',
            path='user/export/NEW PROJECT - all versions - False - 2025-01-01-01-01.csv',  # noqa
        )


class SubmissionsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.SubmissionsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.INT))


class UrlExportFieldExtend(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_tasks.fields.UrlExportField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='eYeXfo2KjbSzXgWuKsJNPY',
        )
