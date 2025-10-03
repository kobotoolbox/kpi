from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_choice_field,
)
from rest_framework import serializers

from kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.extensions import (  # noqa
    StatusEnumFieldExtension,
)
from kpi.schema_extensions.v2.generic.schema import (
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type

from .schema import ROLE_CHOICES_PAYLOAD_ENUM


class MemberUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.MemberUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-members-detail',
            organization_id='orgR6zUBwMHop2mgGygtFd6c',
            user__username='bob',
        )


class RoleChoicePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.RoleChoicePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_choice_field(
            field=serializers.ChoiceField(choices=ROLE_CHOICES_PAYLOAD_ENUM)
        )


class UserUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.UserUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
