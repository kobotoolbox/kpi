from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type, build_basic_type

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetSubscriptionAssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetSubscriptionAssetURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('asset-detail', uid='aBeA23YCYjkGTFvYVHuAyU')



class AssetSubscriptionAssetCurrentPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetUsageCurrentPeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'total_asr_seconds': build_basic_type(Oep)
            }
        )


class AssetSubscriptionAssetAllPeriodFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetUsageAllTimePeriodField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={

            }
        )
