from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class ExtraDetailField(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.ExtraDetailField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'bio': build_basic_type(OpenApiTypes.STR),
                'city': build_basic_type(OpenApiTypes.STR),
                'name': build_basic_type(OpenApiTypes.STR),
                'sector': build_basic_type(OpenApiTypes.STR),
                'country': build_basic_type(OpenApiTypes.STR),
                'twitter': build_basic_type(OpenApiTypes.STR),
                'linkedin': build_basic_type(OpenApiTypes.STR),
                'instagram': build_basic_type(OpenApiTypes.STR),
                'organization': build_basic_type(OpenApiTypes.STR),
                'last_ui_language': build_basic_type(OpenApiTypes.STR),
                'organization_type': build_basic_type(OpenApiTypes.STR),
                'organization_website': build_basic_type(OpenApiTypes.STR),
                'project_views_settings': build_object_type(
                    properties={}
                ),
                'require_auth': build_basic_type(OpenApiTypes.BOOL),
                'newsletter_subscription': build_basic_type(OpenApiTypes.STR),
            }
        )


class GravatarFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.GravatarField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'string',
            'format': 'uri',
            'example': 'https://www.gravatar.com/avatar/5a9aec55090975e64e0f6b0a29110a5f?s=40',  # noqa
        }


class OrganizationFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.OrganizationField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'url': build_url_type(
                    'api_v2:organizations-detail',
                    id='orgzeph7Ub8tVmJ82JBbH96n',
                ),
                'name': build_basic_type(OpenApiTypes.STR),
                'uid': build_basic_type(OpenApiTypes.STR),
            }
        )


class ProjectUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.ProjectUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('user_profile', username='bob')
