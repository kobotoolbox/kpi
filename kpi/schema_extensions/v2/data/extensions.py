from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes


class DataBulkDeleteFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkDeleteField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_basic_type(OpenApiTypes.INT)
        )

class DataValidationStatusesPayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataValidationStatusesPayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_basic_type(OpenApiTypes.INT)
        )

class DataBulkUpdateFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdateField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'field_to_update': build_basic_type(OpenApiTypes.STR),
            }
        )

class DataBulkUpdateResultFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdateResultField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'uuid': build_basic_type(OpenApiTypes.STR),
                    'status_code': build_basic_type(OpenApiTypes.INT),
                    'message': build_basic_type(OpenApiTypes.STR)
                }
            )
        )
