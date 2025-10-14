from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import ASSET_SNAPSHOT_DETAILS_SCHEMA, ASSET_SNAPSHOT_SOURCE_SCHEMA


class AssetSnapshotCreateRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.asset_snapshots.serializers.AssetSnapshotCreateRequest'  # noqa

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=['asset', 'details'],
                    properties={
                        'asset': ASSET_URL_SCHEMA,
                        'details': ASSET_SNAPSHOT_DETAILS_SCHEMA,
                    },
                ),
                build_object_type(
                    required=['source', 'details'],
                    properties={
                        'source': ASSET_SNAPSHOT_SOURCE_SCHEMA,
                        'details': ASSET_SNAPSHOT_DETAILS_SCHEMA,
                    },
                ),
            ]
        }


class AssetSnapshotDetailsExportFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotCreateDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'note': GENERIC_STRING_SCHEMA,
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
            uid_asset_snapshot='sEMPghTguZsxj4rn4s9dvS',
        )


class AssetSnapshotURLUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotUserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA


class AssetSnapshotURLPreviewFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotPreviewURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-preview',
            uid_asset_snapshot='sEMPghTguZsxj4rn4s9dvS',
        )


class AssetSnapshotURLXMLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotXMLURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-detail',
            uid_asset_snapshot='sEMPghTguZsxj4rn4s9dvS',
        )
