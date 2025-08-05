from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type, build_array_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
)

class ExtraDetailField(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.ExtraDetailField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'bio': GENERIC_STRING_SCHEMA,
                'city': GENERIC_STRING_SCHEMA,
                'name': GENERIC_STRING_SCHEMA,
                'sector': GENERIC_STRING_SCHEMA,
                'country': GENERIC_STRING_SCHEMA,
                'twitter': GENERIC_STRING_SCHEMA,
                'linkedin': GENERIC_STRING_SCHEMA,
                'instagram': GENERIC_STRING_SCHEMA,
                'organization': GENERIC_STRING_SCHEMA,
                'last_ui_language': GENERIC_STRING_SCHEMA,
                'organization_type': GENERIC_STRING_SCHEMA,
                'organization_website': GENERIC_STRING_SCHEMA,
                'project_views_settings': GENERIC_OBJECT_SCHEMA,
                'require_auth': build_basic_type(OpenApiTypes.BOOL),
                'newsletter_subscription': GENERIC_STRING_SCHEMA,
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
                'name': GENERIC_STRING_SCHEMA,
                'uid': GENERIC_STRING_SCHEMA,
            }
        )


class ProjectUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.ProjectUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('user_profile', username='bob')


class SocialAccountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.me.fields.SocialAccountField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'provider': GENERIC_STRING_SCHEMA,
                    'uid': GENERIC_STRING_SCHEMA,
                    'last_joined': build_basic_type(OpenApiTypes.DATETIME),
                    'date_joined': build_basic_type(OpenApiTypes.DATETIME),
                    'email': build_basic_type(OpenApiTypes.EMAIL),
                    'username': GENERIC_STRING_SCHEMA,
                }
            )
        )
