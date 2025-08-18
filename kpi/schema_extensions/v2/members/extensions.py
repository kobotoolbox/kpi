from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_basic_type,
    build_choice_field,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers

from kobo.apps.project_ownership.models.choices import InviteStatusChoices
from kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.extensions import (  # noqa
    StatusEnumFieldExtension,
)
from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import ROLE_CHOICES_ENUM, ROLE_CHOICES_PAYLOAD_ENUM


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
                'invited_by': USER_URL_SCHEMA,
                'status': build_choice_field(
                    field=serializers.ChoiceField(
                        choices=InviteStatusChoices.choices
                    )
                ),
                'invitee_role': build_choice_field(
                    field=serializers.ChoiceField(choices=ROLE_CHOICES_ENUM)
                ),
                'organization_name': GENERIC_STRING_SCHEMA,
                'created': build_basic_type(OpenApiTypes.DATETIME),
                'modified': build_basic_type(OpenApiTypes.DATETIME),
                'invitee': GENERIC_STRING_SCHEMA,
            },
            required=[
                'url',
                'invited_by',
                'status',
                'invitee_role',
                'organization_name',
                'created',
                'modified',
            ],
        )


class MemberUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.MemberUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-members-detail',
            organization_id='orgR6zUBwMHop2mgGygtFd6c',
            user__username='bob',
        )


class RoleChoiceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.members.fields.RoleChoiceField'

    def map_serializer_field(self, auto_schema, direction):
        return build_choice_field(
            field=serializers.ChoiceField(choices=ROLE_CHOICES_ENUM)
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
