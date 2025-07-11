from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import XFORM_SCHEMA


class OpenRosaFormHubFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.openrosa.fields.OpenRosaFormHubField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'uuid': build_basic_type(OpenApiTypes.STR),
            }
        )


class OpenRosaMetaFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaMetaField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'instanceID': build_basic_type(OpenApiTypes.STR),
                'rootUuid': build_basic_type(OpenApiTypes.STR),
                'deprecatedID': build_basic_type(OpenApiTypes.STR),
            }
        )


class OpenRosaManifestURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaManifestURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:assetsnapshot-manifest-alias',
            uid='sEMPghTguZsxj4rn4s9dvS',
        )


class OpenRosaXFormActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.openrosa.fields.OpenRosaFileRequestField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return XFORM_SCHEMA


class OpenRosaXFormFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.openrosa.fields.OpenRosaXFormField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'formID': build_basic_type(OpenApiTypes.STR),
                'name': build_basic_type(OpenApiTypes.STR),
                'hash': build_basic_type(OpenApiTypes.STR),
                'descriptionText': build_basic_type(OpenApiTypes.STR),
                'downloadUrl': build_url_type(
                    'api_v2:assetsnapshot-xml-with-disclaimer',
                    uid='sEMPghTguZsxj4rn4s9dvS',
                ),
                'manifestUrl': build_url_type(
                    'api_v2:assetsnapshot-manifest-alias',
                    uid='sEMPghTguZsxj4rn4s9dvS',
                ),
            }
        )
