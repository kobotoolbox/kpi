from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class OpenRosaFormListSerializerExtension(OpenApiSerializerExtension):
    target_class = 'kobo.apps.openrosa.libs.serializers.xform_serializer.XFormListSerializer'  # noqa

    def map_serializer(self, auto_schema, direction):
        xform_schema = build_object_type(
            properties={
                'formID': build_basic_type(OpenApiTypes.STR),
                'name': build_basic_type(OpenApiTypes.STR),
                'majorMinorVersion': build_basic_type(OpenApiTypes.STR),
                'version': build_basic_type(OpenApiTypes.STR),
                'hash': build_basic_type(OpenApiTypes.STR),
                'description': build_basic_type(OpenApiTypes.STR),
                'downloadUrl': build_url_type(
                    'api_v2:download-url-openrosa',
                    id='6',
                ),
                'manifestUrl': build_url_type(
                    'api_v2:manifest-openrosa',
                    id='6',
                ),
            }
        )
        # Ensure XML item element name
        xform_schema.setdefault('xml', {})['name'] = 'xform'

        # Build root array <xforms>
        xforms_schema = build_array_type(schema=xform_schema)
        xforms_schema.setdefault('xml', {}).update({'name': 'xforms', 'wrapped': True})

        return xforms_schema
