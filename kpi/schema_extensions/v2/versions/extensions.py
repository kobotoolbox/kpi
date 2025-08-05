from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    GENERIC_STRING_SCHEMA,
)

class ContentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.ContentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'schema': GENERIC_STRING_SCHEMA,
                'survey': build_array_type(
                    schema=build_object_type(
                        properties={
                            'hint': GENERIC_ARRAY_SCHEMA,
                            'type': GENERIC_STRING_SCHEMA,
                            '$kuid': GENERIC_STRING_SCHEMA,
                            'label': GENERIC_ARRAY_SCHEMA,
                            '$xpath': GENERIC_STRING_SCHEMA,
                            'required': build_basic_type(OpenApiTypes.BOOL),
                            '$autoname': GENERIC_STRING_SCHEMA,
                        }
                    )
                ),
                'settings': build_object_type(
                    properties={
                        'default_language': GENERIC_STRING_SCHEMA,
                    }
                ),
                'translated': GENERIC_ARRAY_SCHEMA,
                'translation': GENERIC_ARRAY_SCHEMA,
            }
        )


class ContentHashFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.ContentHashField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_STRING_SCHEMA


class DateDeployedFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.DateDeployedField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.DATETIME)


class DateModifiedFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.DateModifiedField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.DATETIME)


class UidFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.UidField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_STRING_SCHEMA


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-version-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='vf7pK9SmkJPYZVzr4uypi4',
        )
