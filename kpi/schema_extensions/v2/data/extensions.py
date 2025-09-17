from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA
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
                    pk='1',
                ),
                'download_large_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='large',
                ),
                'download_medium_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='medium',
                ),
                'download_small_url': build_url_type(
                    viewname='api_v2:attachment-thumb',
                    parent_lookup_asset='aTPPUDScaFZkvBzd8FyK4Q',
                    parent_lookup_data='18',
                    pk='attWNZNwhXK6HDYVkZJSn9jy',
                    suffix='small',
                ),
                'mimetype': build_basic_type(OpenApiTypes.STR),
                'filename': build_basic_type(OpenApiTypes.STR),
                'uid': build_basic_type(OpenApiTypes.STR),
                'question_xpath': build_basic_type(OpenApiTypes.STR),
            }
        )


class DataBulkDeleteFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkDeleteField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.INT))


class DataBulkUpdatePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'data': build_object_type(
                    properties={
                        'field_to_update': GENERIC_STRING_SCHEMA,
                    }
                ),
            }
        )


class DataBulkUpdateResultFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdateResultField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'uuid': GENERIC_STRING_SCHEMA,
                    'status_code': build_basic_type(OpenApiTypes.INT),
                    'message': GENERIC_STRING_SCHEMA,
                }
            )
        )


class DataValidationPayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataValidationPayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'validation_status.uid': GENERIC_STRING_SCHEMA,
            }
        )


class EnketoEditUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.EnketoEditUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'enketo_edit_link',
            path='/edit/iXUdUc3w?instance_id=1824b282-f729-4944-b799-7a805d4564e1&return_url=false',  # noqa
        )


class EnketoViewUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.EnketoViewUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'enketo_view_link',
            path='/view/f93d2a488a2e35cedc336e84e1bd1edc?instance_id=1824b282-f729-4944-b799-7a805d4564e1&return_url=false',  # noqa
        )
