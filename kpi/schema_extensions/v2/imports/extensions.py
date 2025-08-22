from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class ImportUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.imports.fields.ImportUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:importtask-detail', uid='iYxVZhbZb6poxVpPqrd6eG')


class MessagesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.imports.fields.MessagesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'updated': build_array_type(
                    schema=build_object_type(
                        properties={
                            'uid': GENERIC_STRING_SCHEMA,
                            'kind': GENERIC_STRING_SCHEMA,
                            'summary': build_object_type(
                                properties={
                                    'geo': build_basic_type(OpenApiTypes.BOOL),
                                    'labels': build_array_type(GENERIC_STRING_SCHEMA),
                                    'columns': build_array_type(GENERIC_STRING_SCHEMA),
                                    'language': build_array_type(GENERIC_STRING_SCHEMA),
                                    'row_count': build_basic_type(OpenApiTypes.INT),
                                    'name_quality': build_object_type(
                                        properties={
                                            'ok': build_basic_type(OpenApiTypes.INT),
                                            'bad': build_basic_type(OpenApiTypes.INT),
                                            'good': build_basic_type(OpenApiTypes.INT),
                                            'total': build_basic_type(OpenApiTypes.INT),
                                            'first': GENERIC_OBJECT_SCHEMA,
                                        }
                                    ),
                                    'default_translation': build_basic_type(
                                        OpenApiTypes.STR
                                    ),
                                }
                            ),
                            'owner__username': GENERIC_STRING_SCHEMA,
                        }
                    )
                ),
                'audit-logs': build_array_type(
                    schema=build_object_type(
                        properties={
                            'source': GENERIC_STRING_SCHEMA,
                            'asset_id': build_basic_type(OpenApiTypes.INT),
                            'new_name': GENERIC_STRING_SCHEMA,
                            'old_name': GENERIC_STRING_SCHEMA,
                            'asset_uid': GENERIC_STRING_SCHEMA,
                            'ip_address': GENERIC_STRING_SCHEMA,
                            'project_owner': GENERIC_STRING_SCHEMA,
                            'latest_version_uid': GENERIC_STRING_SCHEMA,
                        }
                    )
                ),
                'error': GENERIC_STRING_SCHEMA,
                'error_type': GENERIC_STRING_SCHEMA,
            }
        )
