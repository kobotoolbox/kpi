from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

"""
Common schemas to avoid redundancy
"""

BALANCE_FIELDS_OBJECTS = build_object_type(
    properties={
        'effective_limit': build_basic_type(OpenApiTypes.INT),
        'balance_value': build_basic_type(OpenApiTypes.INT),
        'balance_percent': build_basic_type(OpenApiTypes.INT),
        'exceeded': build_basic_type(OpenApiTypes.INT),
    }
)
