from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class ImportUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.imports.fields.ImportUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:importtask-detail',
            uid='iYxVZhbZb6poxVpPqrd6eG'
        )


class MessagesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.imports.fields.MessagesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'updated': build_array_type(
                    schema=build_object_type(
                        properties={
                            'uid': build_basic_type(OpenApiTypes.STR),
                            'kind': build_basic_type(OpenApiTypes.STR),
                            'summary': build_object_type(
                                properties={
                                    'geo': build_basic_type(OpenApiTypes.BOOL),
                                    'labels': build_array_type(
                                        build_basic_type(OpenApiTypes.STR)
                                    ),
                                    'columns': build_array_type(
                                        build_basic_type(OpenApiTypes.STR)
                                    ),
                                    'language': build_array_type(
                                        build_basic_type(OpenApiTypes.STR)
                                    ),
                                    'row_count': build_basic_type(OpenApiTypes.INT),
                                    'default_translation': build_basic_type(
                                        OpenApiTypes.STR
                                    ),
                                }
                            ),
                            'owner__username': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
                'error': build_basic_type(OpenApiTypes.STR),
                'error_type': build_basic_type(OpenApiTypes.STR),
            }
        )
