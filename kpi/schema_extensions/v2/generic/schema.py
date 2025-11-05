from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

"""
Generic schemas to avoid redundancy
"""

ASSET_URL_SCHEMA = build_url_type(
    'api_v2:asset-detail', uid_asset='a3C9wWefqZVkChNLKqqXVZ'
)

BALANCE_FIELDS_SCHEMA = build_object_type(
    properties={
        'effective_limit': build_basic_type(OpenApiTypes.INT),
        'balance_value': build_basic_type(OpenApiTypes.INT),
        'balance_percent': build_basic_type(OpenApiTypes.INT),
        'exceeded': build_basic_type(OpenApiTypes.BOOL),
    },
    required=[
        'effective_limit',
        'balance_value',
        'balance_percent',
        'exceeded',
    ],
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
        'total_nlp_llm_requests': build_basic_type(OpenApiTypes.INT),
    }

    required=[
        'total_nlp_asr_seconds',
        'total_nlp_mt_characters',
    ],
)

GENERIC_NLP_ALL_TIME_OBJECT_SCHEMA = build_object_type(
    properties={
        'asr_seconds_current_period': build_basic_type(OpenApiTypes.INT),
        'mt_characters_current_period': build_basic_type(OpenApiTypes.INT),
        'llm_requests_current_period': build_basic_type(OpenApiTypes.INT),
        'asr_seconds_all_time': build_basic_type(OpenApiTypes.INT),
        'mt_characters_all_time': build_basic_type(OpenApiTypes.INT),
        'llm_requests_all_time': build_basic_type(OpenApiTypes.INT),
    }
    required=[
        'asr_seconds_current_period',
        'mt_characters_current_period',
        'asr_seconds_all_time',
        'mt_characters_all_time',
    ],
)

GENERIC_STRING_SCHEMA = build_basic_type(OpenApiTypes.STR)

GENERIC_OBJECT_SCHEMA = build_object_type(properties={})

USER_URL_SCHEMA = build_url_type('api_v2:user-kpi-detail', username='bob')
