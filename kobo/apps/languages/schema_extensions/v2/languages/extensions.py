from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class LanguageUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.languages.schema_extensions.v2.languages.fields.LanguageUrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:language-detail', code='en')


class ServicesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.languages.schema_extensions.v2.languages.fields.ServicesField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'code': build_basic_type(OpenApiTypes.STR),
                    'name': build_basic_type(OpenApiTypes.STR),
                }
            )
        )
