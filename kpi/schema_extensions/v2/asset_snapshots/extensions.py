from django.conf import settings
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from rest_framework.reverse import reverse


class AssetSnapshotDetailsExportFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotCreateDetailsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'note': build_basic_type(OpenApiTypes.STR),
            },
        }


class AssetSnapshotDetailsFieldExtension(OpenApiSerializerFieldExtension):
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
                            'message': build_basic_type(OpenApiTypes.STR),
                        },
                    },
                },
            },
        }


class AssetSnapshotSourceFieldExtension(OpenApiSerializerFieldExtension):
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
                            '$autoname': build_basic_type(OpenApiTypes.STR),
                        },
                    },
                },
                'settings': {
                    'type': 'object',
                    'properties': {
                        'form_title': build_basic_type(OpenApiTypes.STR),
                    },
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


class AssetSnapshotURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-detail', kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'}
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }


class AssetSnapshotURLUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotURLUserField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:user-kpi-detail', kwargs={'username': 'bob'}
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }


class AssetSnapshotURLPreviewFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotURLPreviewField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-preview', kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'}
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }


class AssetSnapshotURLXMLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_snapshots.fields.AssetSnapshotURLXMLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-detail',
            kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'},
            format='xml',
        )

        return {
            'type': 'string',
            'format': 'uri',
            'example': example_url,
        }
