from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Common schemas to avoid redundancy
"""

BASE64_METADATA_SCHEMA = build_object_type(
    required=['filename'],
    properties={
        'filename': build_basic_type(OpenApiTypes.STR),
    },
)

FILE_URL_SCHEMA = build_url_type(
    'api_v2:asset-file-detail',
    parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
    uid='afSa8PqnoYe8vJqkrsGz3oN',
)

URL_METADATA_SCHEMA = build_object_type(
    required=['redirect_url'],
    properties={
        'redirect_url': build_basic_type(OpenApiTypes.URI),
    },
)
