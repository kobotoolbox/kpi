from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from kpi.utils.schema_extensions.url_builder import build_url_type


class OpenRosaManifestURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.openrosa.schema_extensions.v2.manifest.fields.OpenRosaFormManifestURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:manifest-openrosa',
            id='1',
        )
