from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.constants import PERM_CHANGE_ASSET
from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Common schemas to avoid redundancy
"""

PERMISSION_ASSIGNMENT_LABEL_SCHEMA = build_basic_type(OpenApiTypes.STR)

PERMISSION_URL_SCHEMA = build_url_type(
    'api_v2:permission-detail',
    codename=PERM_CHANGE_ASSET,
)

ASSET_PERMISSION_ASSIGNMENT_URL_SCHEMA = build_url_type(
    'api_v2:asset-permission-assignment-detail',
    parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
    uid='pGaXCTDAbdZKLXoXAXd3M4',
)

ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA = build_array_type(
    schema=build_object_type(
        properties={
            'filter': build_array_type(
                schema=build_object_type(
                    properties={
                        '_submitted_by': build_object_type(
                            properties={
                                '$in': build_array_type(
                                    schema=build_basic_type(OpenApiTypes.STR)
                                )
                            }
                        )
                    }
                )
            ),
            'url': ASSET_PERMISSION_ASSIGNMENT_URL_SCHEMA,
        }
    )
)
