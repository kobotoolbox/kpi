from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class DataAttachmentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataAttachmentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'download_url': build_url_type(
                    viewname='api_v2:attachment-detail',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='1'
                ),
                'download_large_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='large'
                ),
                'download_medium_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='medium'
                ),
                'download_small_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='small'
                ),
                'mimetype': build_basic_type(OpenApiTypes.STR),
                'filename': build_basic_type(OpenApiTypes.STR),
                'uid': build_basic_type(OpenApiTypes.STR),
                'question_xpath': build_basic_type(OpenApiTypes.STR)
            }
        )

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
