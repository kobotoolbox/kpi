from django.conf import settings
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from rest_framework.reverse import reverse


class OpenRosaFormHubFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.openrosa.fields.OpenRosaFormHubField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'uuid': build_basic_type(OpenApiTypes.STR),
            },
        }


class OpenRosaMetaFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaMetaField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'instanceID': build_basic_type(OpenApiTypes.STR),
                'rootUuid': build_basic_type(OpenApiTypes.STR),
                'deprecatedID': build_basic_type(OpenApiTypes.STR),
            },
        }


class OpenRosaManifestURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaManifestURLField'

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-manifest-alias',
            kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'},
        )

        return {
            'type': 'string',
            'format': 'url',
            'example': example_url,
        }


class OpenRosaXFormActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.openrosa.fields.OpenRosaFileRequestField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'head': {
                    'type': 'object',
                    'properties': {
                        'title': build_basic_type(OpenApiTypes.STR),
                        'model': {
                            'type': 'object',
                            'properties': {
                                'instance': {
                                    'type': 'object',
                                    'properties': {
                                        'instanceUuid': {
                                            'type': 'object',
                                            'properties': {
                                                'fieldName': build_basic_type(
                                                    OpenApiTypes.NONE
                                                ),
                                                'meta': {
                                                    'type': 'object',
                                                    'properties': {
                                                        'instanceID': build_basic_type(
                                                            OpenApiTypes.NONE
                                                        ),
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                'body': {
                    'type': 'object',
                    'properties': {
                        'input': {
                            'type': 'object',
                            'properties': {
                                'label': build_basic_type(OpenApiTypes.STR),
                                'hint': build_basic_type(OpenApiTypes.STR),
                            },
                        },
                    },
                },
            },
        }


class OpenRosaXFormFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaXFormField'

    def map_serializer_field(self, auto_schema, direction):
        example_download_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-xml-with-disclaimer',
            kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'},
        )
        example_manifest_url = settings.KOBOFORM_URL + reverse(
            'api_v2:assetsnapshot-manifest-alias',
            kwargs={'uid': 'sEMPghTguZsxj4rn4s9dvS'},
        )

        return {
            'type': 'object',
            'properties': {
                'formID': build_basic_type(OpenApiTypes.STR),
                'name': build_basic_type(OpenApiTypes.STR),
                'hash': build_basic_type(OpenApiTypes.STR),
                'descriptionText': build_basic_type(OpenApiTypes.STR),
                'downloadUrl': {
                    'type': 'string',
                    'format': 'url',
                    'example': example_download_url,
                },
                'manifestUrl': {
                    'type': 'string',
                    'format': 'url',
                    'example': example_manifest_url,
                },
            },
        }
