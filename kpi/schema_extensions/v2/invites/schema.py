from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes

"""
Common schemas to avoid redundancy
"""


INVITE_ROLE_SCHEMA = build_basic_type(OpenApiTypes.STR)


INVITE_STATUS_SCHEMA = build_basic_type(OpenApiTypes.STR)
