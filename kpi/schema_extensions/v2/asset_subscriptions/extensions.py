from django.conf import settings
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from rest_framework.reverse import reverse


class AssetSubscriptionURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetSubscriptionURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:userassetsubscription-detail',
            kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'}  # noqa
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }


class AssetSubscriptionAssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_subscriptions.fields.AssetSubscriptionAssetURLField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'asset-detail',
            kwargs={'uid': 'aBeA23YCYjkGTFvYVHuAyU'}  # noqa
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }
