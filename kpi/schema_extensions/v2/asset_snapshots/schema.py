from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

"""
Common schemas to avoid redundancy
"""
ASSET_SNAPSHOT_DETAILS_SCHEMA = build_object_type(
    properties={
        'status': build_basic_type(OpenApiTypes.STR),
        'warnings': build_array_type(
            schema=build_object_type(
                properties={
                    'code': build_basic_type(OpenApiTypes.STR),
                    'message': build_basic_type(OpenApiTypes.STR),
                }
            )
        ),
    }
)

ASSET_SNAPSHOT_SOURCE_SCHEMA = (
    build_object_type(
        properties={
            'schema': build_basic_type(OpenApiTypes.STR),
            'survey': build_array_type(
                schema=build_object_type(
                    properties={
                        'name': build_basic_type(OpenApiTypes.STR),
                        'type': build_basic_type(OpenApiTypes.STR),
                    }
                )
            ),
            'settings': build_object_type(
                properties={
                    'form_title': build_basic_type(OpenApiTypes.STR),
                }
            ),
            'translated': build_array_type(
                schema=build_basic_type(OpenApiTypes.STR),
            ),
            'translation': build_array_type(
                schema=build_basic_type(OpenApiTypes.STR)
            ),
        }
    ))
