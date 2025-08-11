from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class OpenRosaXFormFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.openrosa.schema_extensions.v2.formlist.fields.OpenRosaXFormField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'formID': build_basic_type(OpenApiTypes.STR),
                    'name': build_basic_type(OpenApiTypes.STR),
                    'majorMinorVersion': build_basic_type(OpenApiTypes.STR),
                    'version': build_basic_type(OpenApiTypes.STR),
                    'hash': build_basic_type(OpenApiTypes.STR),
                    'description': build_basic_type(OpenApiTypes.STR),
                    'downloadUrl': build_url_type(
                        'api_v2:assetsnapshot-xml-with-disclaimer',
                        uid='sEMPghTguZsxj4rn4s9dvS',
                    ),
                    'manifestUrl': build_url_type(
                        'api_v2:assetsnapshot-manifest-openrosa',
                        uid='sEMPghTguZsxj4rn4s9dvS',
                    ),
                }
            )
        )
