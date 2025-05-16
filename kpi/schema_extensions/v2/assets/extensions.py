from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from .schema import ASSET_URL_SCHEMA


class AssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetURLField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA
