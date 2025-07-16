from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class ContentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.ContentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'schema': build_basic_type(OpenApiTypes.STR),
                'survey': build_array_type(
                    schema=build_object_type(
                        properties={
                            'hint': build_array_type(
                                schema=build_basic_type(OpenApiTypes.STR),
                            ),
                            'type': build_basic_type(OpenApiTypes.STR),
                            '$kuid': build_basic_type(OpenApiTypes.STR),
                            'label': build_array_type(
                                schema=build_basic_type(OpenApiTypes.STR),
                            ),
                            '$xpath': build_basic_type(OpenApiTypes.STR),
                            'required': build_basic_type(OpenApiTypes.BOOL),
                            '$autoname': build_basic_type(OpenApiTypes.STR),
                        }
                    )
                ),
                'settings': build_object_type(
                    properties={
                        'default_language': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'translated': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR),
                ),
                'translation': build_array_type(
                    schema=build_basic_type(OpenApiTypes.STR),
                ),
            }
        )


class ContentHashFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.ContentHashField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.STR)


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
        return build_basic_type(OpenApiTypes.STR)


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.versions.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-version-detail',
            parent_lookup_asset='a3C9wWefqZVkChNLKqqXVZ',
            uid='vf7pK9SmkJPYZVzr4uypi4',
        )
