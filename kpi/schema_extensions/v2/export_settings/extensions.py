from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type, build_basic_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class CreatePayloadFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.export_settings.fields.CreatePayloadField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
                'group_sep': build_basic_type(OpenApiTypes.STR),
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'lang': build_basic_type(OpenApiTypes.BOOL),
                'multiple_select': build_basic_type(OpenApiTypes.STR),
                'types': build_basic_type(OpenApiTypes.STR),
                'fields': build_array_type(schema={}),
                'flatten': build_basic_type(OpenApiTypes.BOOL),
                'xls_types_as_text': build_basic_type(OpenApiTypes.BOOL),
                'include_media_url': build_basic_type(OpenApiTypes.BOOL),
                'submission_ids': build_array_type(schema=build_basic_type(OpenApiTypes.INT)),
                'query': build_object_type(
                    properties={
                        '$and': build_array_type(
                            schema=build_object_type(
                                properties={
                                    '_submission_time': build_object_type(
                                        properties={
                                            '$gte/$lte': build_basic_type(OpenApiTypes.DATE)
                                        }
                                    )
                                }
                            )
                        )
                    }
                )
            }
        )


class ExportSettingsFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.export_settings.fields.ExportSettingsField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'lang': build_basic_type(OpenApiTypes.STR),
                'type': build_basic_type(OpenApiTypes.STR),
                'fields': build_object_type(
                    properties={
                        '0': build_basic_type(OpenApiTypes.STR),
                        '1': build_basic_type(OpenApiTypes.STR),
                        '2': build_basic_type(OpenApiTypes.STR),
                        '3': build_basic_type(OpenApiTypes.STR),
                        '4': build_basic_type(OpenApiTypes.STR),
                        '5': build_basic_type(OpenApiTypes.STR),
                        '6': build_basic_type(OpenApiTypes.STR),
                        '7': build_basic_type(OpenApiTypes.STR),
                        '8': build_basic_type(OpenApiTypes.STR),
                        '9': build_basic_type(OpenApiTypes.STR),
                        '10': build_basic_type(OpenApiTypes.STR),
                        '11': build_basic_type(OpenApiTypes.STR),
                        '12': build_basic_type(OpenApiTypes.STR),
                        '13': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'group_sep': build_basic_type(OpenApiTypes.STR),
                'multiple_select': build_basic_type(OpenApiTypes.STR),
                'include_media_url': build_basic_type(OpenApiTypes.BOOL),
                'xls_types_as_text': build_basic_type(OpenApiTypes.BOOL),
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
            }
        )


class DataUrlCSVFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.export_settings.fields.DataUrlCSVField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
            format='csv'
        )


class DataUrlXLSXFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.export_settings.fields.DataUrlXLSXField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
            format='xlsx'
        )


class UrlFieldFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.export_settings.fields.UrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-settings-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='esMxJfzPhnWn6r2c3EKkuaV',
        )


class UpdatePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.export_settings.fields.UpdatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'fields_from_all_versions': build_basic_type(OpenApiTypes.BOOL),
                'group_sep': build_basic_type(OpenApiTypes.STR),
                'hierarchy_in_labels': build_basic_type(OpenApiTypes.BOOL),
                'lang': build_basic_type(OpenApiTypes.STR),
                'multiple_select': build_basic_type(OpenApiTypes.STR),
                'type': build_basic_type(OpenApiTypes.STR),
                'fields': build_array_type(schema={})
            }
        )
