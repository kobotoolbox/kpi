from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Common schemas to avoid redundancy
"""

ASSET_URL = build_url_type('api_v2:asset-detail', uid='a3C9wWefqZVkChNLKqqXVZ')

BASE64_METADATA = build_object_type(
    properties={
        'filename': build_basic_type(OpenApiTypes.STR),
    }
)

FILE_URL = build_url_type(
    'api_v2:asset-file-detail',
    parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
    uid='afSa8PqnoYe8vJqkrsGz3oN',
)

URL_METADATA = build_object_type(
    properties={
        'redirect_url': build_basic_type(OpenApiTypes.URI),
    }
)


USER_URL = build_url_type('user-kpi-detail', username='bob')
