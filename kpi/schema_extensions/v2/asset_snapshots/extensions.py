from drf_spectacular.extensions import OpenApiSerializerFieldExtension, _SchemaType
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import Direction


class AssetSnapshotDetailsField(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'status': build_basic_type(OpenApiTypes.STR),
                'warnings': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'code': build_basic_type(OpenApiTypes.STR),
                            'message': build_basic_type(OpenApiTypes.STR)
                        }
                    }
                },
            },
        }


class AssetSnapshotDetailsExportField(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotCreateDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'status': build_basic_type(OpenApiTypes.STR),
                'warnings': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'code': build_basic_type(OpenApiTypes.STR),
                            'message': build_basic_type(OpenApiTypes.STR)
                        }
                    }
                },
                'note': build_basic_type(OpenApiTypes.STR)
            },
        }


class AssetSnapshotSourceField(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotSourceField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'schema': build_basic_type(OpenApiTypes.STR),
                'survey': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'name': build_basic_type(OpenApiTypes.STR),
                            'type': build_basic_type(OpenApiTypes.STR),
                            '$autoname': build_basic_type(OpenApiTypes.STR)
                        }
                    },
                },
                'settings': {
                    'type': 'object',
                    'properties': {
                        'form_title': build_basic_type(OpenApiTypes.STR),
                    }
                },
                'translated': {
                    'type': 'array',
                    'items': build_basic_type(OpenApiTypes.STR),
                },
                'translation': {
                    'type': 'array',
                    'items': build_basic_type(OpenApiTypes.STR),
                },
            },
        }
