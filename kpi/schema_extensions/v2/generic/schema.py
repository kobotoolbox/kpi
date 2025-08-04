from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Generic schemas to avoid redundancy
"""

ASSET_URL_SCHEMA = build_url_type('api_v2:asset-detail', uid='a3C9wWefqZVkChNLKqqXVZ')

USER_URL_SCHEMA = build_url_type('api_v2:user-kpi-detail', username='bob')

BALANCE_FIELDS_SCHEMA = build_object_type(
    properties={
        'effective_limit': build_basic_type(OpenApiTypes.INT),
        'balance_value': build_basic_type(OpenApiTypes.INT),
        'balance_percent': build_basic_type(OpenApiTypes.INT),
        'exceeded': build_basic_type(OpenApiTypes.INT),
    }
)
