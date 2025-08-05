from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import GENERIC_OBJECT_SCHEMA


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
                            'owner__username': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
                'audit-logs': build_array_type(
                    schema=build_object_type(
                        properties={
                            'source': build_basic_type(OpenApiTypes.STR),
                            'asset_id': build_basic_type(OpenApiTypes.INT),
                            'new_name': build_basic_type(OpenApiTypes.STR),
                            'old_name': build_basic_type(OpenApiTypes.STR),
                            'asset_uid': build_basic_type(OpenApiTypes.STR),
                            'ip_address': build_basic_type(OpenApiTypes.STR),
                            'project_owner': build_basic_type(OpenApiTypes.STR),
                            'latest_version_uid': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
                'error': build_basic_type(OpenApiTypes.STR),
                'error_type': build_basic_type(OpenApiTypes.STR),
            }
        )
