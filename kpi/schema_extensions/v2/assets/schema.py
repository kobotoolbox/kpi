from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.mixins import ObjectPermissionMixin
from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Common schemas to avoid redundancy
"""

ASSET_CLONE_FROM = build_basic_type(OpenApiTypes.STR)

ASSET_CONTENT = build_basic_type(OpenApiTypes.STR)

ASSET_ENABLED = build_basic_type(OpenApiTypes.BOOL)

ASSET_FIELDS = build_array_type(schema={})

ASSET_SETTINGS = build_object_type(
    properties={
        'description': build_basic_type(OpenApiTypes.STR),
        'sector': build_basic_type(OpenApiTypes.STR),
        'country': build_basic_type(OpenApiTypes.STR),
        'share-metadata': build_basic_type(OpenApiTypes.BOOL),
    }
)

ASSET_NAME = build_basic_type(OpenApiTypes.STR)

ASSET_TYPE = build_basic_type(OpenApiTypes.STR)

ASSET_URL_SCHEMA = build_url_type('api_v2:asset-detail', uid='a5owyo85mHyFazzgsZK45c')

BULK_ACTION = build_object_type(properties={})

BULK_ASSET_UIDS = build_object_type(
    properties={
        'asset_uids': build_array_type(
            schema=build_object_type(
                properties={},
            ),
        ),
    }
)

BULK_CONFIRM = build_basic_type(OpenApiTypes.BOOL)
