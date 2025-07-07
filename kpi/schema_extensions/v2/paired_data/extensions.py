from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class FieldFieldsExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.FieldFields'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_basic_type(OpenApiTypes.STR)
        )


class SourceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.SourceField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-detail', uid='a5owyo85mHyFazzgsZK45c')



class SourceNameFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.SourceNameField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.STR)


class URLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.paired_data.fields.URLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:paired-data-detail',
            parent_lookup_asset='a5owyo85mHyFazzgsZK45c',
            paired_data_uid='pd9CWSKADt4T7h5bMKwhLqq'
        )

