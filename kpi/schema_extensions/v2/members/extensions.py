from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class InviteFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.InviteField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'url': build_url_type(
                    'api_v2:organization-invites-detail',
                    organization_id='orgR6zUBwMHop2mgGygtFd6c',
                    guid='f3ba00b2-372b-4283-9d57-adbe7d5b1bf1',
                ),
                'invited_by': build_url_type(
                    'api_v2:user-kpi-detail',
                    username='bob',
                ),
                'status': build_basic_type(OpenApiTypes.STR),
                'invitee_role': build_basic_type(OpenApiTypes.STR),
                'created': build_basic_type(OpenApiTypes.DATETIME),
                'modified': build_basic_type(OpenApiTypes.DATETIME),
                'invitee': build_basic_type(OpenApiTypes.STR),
            }
        )


class MemberUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.MemberUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-members-detail',
            organization_id='orgR6zUBwMHop2mgGygtFd6c',
            user__username='bob'
        )


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.UserUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:user-kpi-detail',
            username='bob'
        )
