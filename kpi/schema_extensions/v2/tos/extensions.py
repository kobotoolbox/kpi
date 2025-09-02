from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from kpi.utils.schema_extensions.url_builder import build_url_type


class TOSDetailURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.tos.fields.TOSDetailURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:terms-of-service-detail', slug='terms_of_service_fr'
        )
