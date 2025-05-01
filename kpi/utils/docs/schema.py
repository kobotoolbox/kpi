from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.utils import OpenApiTypes
from rest_framework import renderers, serializers, status

class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.views.v2.asset_snapshot.AbcdJSONField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'details': build_basic_type(OpenApiTypes.STR),
                'warnings': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'code': build_basic_type(OpenApiTypes.STR),
                            'message': build_basic_type(OpenApiTypes.STR),
                        },
                        'required': ['code', 'message'],
                    },
                }
            },
        }


class SnapshotDetailsFieldsExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.views.v2.asset_snapshot.SnapshotDetailsField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'details': build_basic_type(OpenApiTypes.STR),
                'warnings': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'code': build_basic_type(OpenApiTypes.STR),
                            'message': build_basic_type(OpenApiTypes.STR),
                        },
                        'required': ['code', 'message'],
                    },
                }
            },
        }


class ConfigFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.views.v2.asset_snapshot.QwertJSONField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'retry': build_basic_type(OpenApiTypes.INT),
                'enabled': build_basic_type(OpenApiTypes.BOOL),
            },
            'required': ['retry'],
        }
