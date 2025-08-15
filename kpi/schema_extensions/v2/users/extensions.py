from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_object_type,
)

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.users.fields.MetadataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'name': GENERIC_STRING_SCHEMA,
                'sector': GENERIC_STRING_SCHEMA,
                'country': GENERIC_STRING_SCHEMA,
                'organization': GENERIC_STRING_SCHEMA,
                'last_ui_language': GENERIC_STRING_SCHEMA,
                'organization_type': GENERIC_STRING_SCHEMA,
                'organization_website': GENERIC_STRING_SCHEMA,
                'project_views_settings': build_object_type(
                    properties={
                        'kobo_my_project': build_object_type(
                            properties={
                                'order': GENERIC_OBJECT_SCHEMA,
                                'fields': GENERIC_ARRAY_SCHEMA,
                                'filters': GENERIC_ARRAY_SCHEMA,
                            }
                        )
                    }
                ),
            }
        )


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.users.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
