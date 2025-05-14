from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from ..assets.schema import ASSET_URL_SCHEMA
from .schema import ASSET_SNAPSHOT_DETAILS_SCHEMA, ASSET_SNAPSHOT_SOURCE_SCHEMA


class AssetSnapshotCreateRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.asset_snapshots.serializers.AssetSnapshotCreateRequest'  # noqa

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    properties={
                        'asset': ASSET_URL_SCHEMA,
                        'details': ASSET_SNAPSHOT_DETAILS_SCHEMA,
                    }
                ),
                build_object_type(
                    properties={
                        'source': ASSET_SNAPSHOT_SOURCE_SCHEMA,
                        'details': ASSET_SNAPSHOT_DETAILS_SCHEMA,
                    }
                ),
            ]
        }


class AssetSnapshotDetailsExportFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotCreateDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'note': build_basic_type(OpenApiTypes.STR),
            }
        )


class AssetSnapshotDetailsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_SNAPSHOT_DETAILS_SCHEMA


class AssetSnapshotSourceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotSourceField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_SNAPSHOT_SOURCE_SCHEMA


class AssetSnapshotURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotURLField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-detail',
            uid='sEMPghTguZsxj4rn4s9dvS',
        )


class AssetSnapshotURLUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotUserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:user-kpi-detail', username='bob')


class AssetSnapshotURLPreviewFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotPreviewURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-preview',
            uid='sEMPghTguZsxj4rn4s9dvS',
        )


class AssetSnapshotURLXMLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotXMLURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-detail',
            uid='sEMPghTguZsxj4rn4s9dvS',
        )
