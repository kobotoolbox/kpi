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
    USER_URL_SCHEMA,
)


class CeleryTaskExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.users.fields.CeleryTask'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'user-kpi-migrate',
            username='bob',
            task_id='4c586952-a95a-4cdf-a5b7-e03137c6e33d',
        )


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.users.fields.MetadataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'name': build_basic_type(OpenApiTypes.STR),
                'sector': build_basic_type(OpenApiTypes.STR),
                'country': build_basic_type(OpenApiTypes.STR),
                'organization': build_basic_type(OpenApiTypes.STR),
                'last_ui_language': build_basic_type(OpenApiTypes.STR),
                'organization_type': build_basic_type(OpenApiTypes.STR),
                'organization_website': build_basic_type(OpenApiTypes.STR),
                'project_views_settings': build_object_type(
                    properties={
                        'kobo_my_project': build_object_type(
                            properties={
                                'order': build_object_type(properties={}),
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
