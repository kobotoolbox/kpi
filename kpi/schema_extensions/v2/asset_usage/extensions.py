from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type, build_basic_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetUsageURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('asset-detail', uid='aBeA23YCYjkGTFvYVHuAyU')


class AssetUsageCurrentPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageCurrentPeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'total_nlp_asr_seconds': build_basic_type(OpenApiTypes.INT),
                'total_nlp_mt_characters': build_basic_type(OpenApiTypes.INT),
            }
        )


class AssetUsageAllPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_usage.fields.AssetUsageAllTimePeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'total_nlp_asr_seconds': build_basic_type(OpenApiTypes.INT),
                'total_nlp_mt_characters': build_basic_type(OpenApiTypes.INT),
            }
        )
