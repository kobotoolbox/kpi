from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Generic schemas to avoid redundancy
"""

ASSET_URL_SCHEMA = build_url_type('api_v2:asset-detail', uid='a3C9wWefqZVkChNLKqqXVZ')

BALANCE_FIELDS_SCHEMA = build_object_type(
    properties={
        'effective_limit': build_basic_type(OpenApiTypes.INT),
        'balance_value': build_basic_type(OpenApiTypes.INT),
        'balance_percent': build_basic_type(OpenApiTypes.INT),
        'exceeded': build_basic_type(OpenApiTypes.INT),
    }
)

LABEL_VALUE_OBJECT_SCHEMA = build_object_type(
    properties={
        'label': build_basic_type(OpenApiTypes.STR),
        'value': build_basic_type(OpenApiTypes.STR),
    }
)

GENERIC_ARRAY_SCHEMA = build_array_type(schema=build_basic_type(OpenApiTypes.STR))

GENERIC_NLP_OBJECT_SCHEMA = build_object_type(
    properties={
        'total_nlp_asr_seconds': build_basic_type(OpenApiTypes.INT),
        'total_nlp_mt_characters': build_basic_type(OpenApiTypes.INT),
    }
)

GENERIC_STRING_SCHEMA = build_basic_type(OpenApiTypes.STR)

USER_URL_SCHEMA = build_url_type('api_v2:user-kpi-detail', username='bob')
