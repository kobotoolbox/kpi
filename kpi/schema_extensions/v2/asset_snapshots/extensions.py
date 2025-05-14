from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


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
        return build_object_type(
            properties={
                'status': build_basic_type(OpenApiTypes.STR),
                'warnings': build_array_type(
                    schema=build_object_type(
                        properties={
                            'code': build_basic_type(OpenApiTypes.STR),
                            'message': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
            }
        )


class AssetSnapshotSourceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotSourceField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'schema': build_basic_type(OpenApiTypes.STR),
                'survey': build_array_type(
                    schema=build_object_type(
                        properties={
                            'name': build_basic_type(OpenApiTypes.STR),
                            'type': build_basic_type(OpenApiTypes.STR),
                            '$autoname': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
                'settings': build_object_type(
                    properties={
                        'form_title': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'translated': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR),
                ),
                'translation': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR)
                ),
            }
        )


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
