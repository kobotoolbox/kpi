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

ASSET_URL_SCHEMA = build_url_type('api_v2:asset-detail', uid='a5owyo85mHyFazzgsZK45c')
