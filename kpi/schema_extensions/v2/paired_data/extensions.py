from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type, build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class DataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.DataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'data': build_array_type(
                    schema=build_object_type(
                        properties={
                            'id': GENERIC_STRING_SCHEMA,
                            'version': GENERIC_STRING_SCHEMA,
                            'field_value_1': GENERIC_STRING_SCHEMA,
                            'field_value_2': GENERIC_STRING_SCHEMA,
                        }
                    )
                )
            }
        )


class FieldFieldsExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.FieldFields'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=GENERIC_STRING_SCHEMA)


class SourceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.SourceField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class SourceNameFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.SourceNameField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_STRING_SCHEMA


class URLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.URLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:paired-data-detail',
            parent_lookup_asset='a5owyo85mHyFazzgsZK45c',
            paired_data_uid='pd9CWSKADt4T7h5bMKwhLqq',
        )
