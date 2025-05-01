from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.utils import OpenApiTypes


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.views.v2.asset_snapshot.AbcdJSONField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'author': build_basic_type(OpenApiTypes.STR),
                'created': build_basic_type(OpenApiTypes.DATETIME),
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

# class RestrictedJsonFieldExtension(OpenApiSerializerFieldExtension):
#     target_class = "rest_framework.fields.JSONField"
#     # match_subclasses = True  # not needed here but good to know.
#
#     def map_serializer_field(self, auto_schema, direction):
#         return {
#             'type': 'object',
#             'properties': {
#                 'key1': build_basic_type(OpenApiTypes.STR),
#                 'key2': build_basic_type(OpenApiTypes.INT),
#                 'nested': {
#                     'type': 'object',
#                     'properties': {
#                         'subkey': build_basic_type(OpenApiTypes.BOOL),
#                     },
#                 },
#             },
#             'required': ['key1'],
#         }
