from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_NLP_OBJECT_SCHEMA,
)


class AssetUsageURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageURLField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class AssetUsageCurrentPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageCurrentPeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_OBJECT_SCHEMA


class AssetUsageAllPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageAllTimePeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_OBJECT_SCHEMA
