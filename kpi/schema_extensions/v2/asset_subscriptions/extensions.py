from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetSubscriptionURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetSubscriptionURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:userassetsubscription-detail',
            uid='sEMPghTguZsxj4rn4s9dvS',
        )


class AssetSubscriptionAssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetSubscriptionAssetURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('asset-detail', uid='aBeA23YCYjkGTFvYVHuAyU')
