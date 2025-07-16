from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Common schemas to avoid redundancy
"""

PERMISSION_ASSIGNMENT_LABEL_FIELD = build_basic_type(OpenApiTypes.STR)

# PERMISSION_ASSIGNMENT_CHANGE_ASSET = build_url_type(
#     'api_v2:permission-detail',
#     codename='change_assets',
# )

PERMISSION_ASSIGNMENT_CHANGE_ASSET = build_basic_type(OpenApiTypes.STR)


PARTIAL_PERMISSION = build_array_type(
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
            'url': PERMISSION_ASSIGNMENT_CHANGE_ASSET,
        }
    )
)

# PERMISSION_ASSIGNMENT_URL_FIELD = build_url_type(
#     'api_v2:asset-permission-assignment-detail',
#     parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
#     uid='pGaXCTDAbdZKLXoXAXd3M4',
# )

PERMISSION_ASSIGNMENT_USER_FIELD = build_url_type('api_v2:user-kpi-detail', username='bob')
