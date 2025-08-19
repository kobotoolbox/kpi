from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type, build_choice_field
from rest_framework import serializers

from kobo.apps.organizations.models import OrganizationInviteStatusChoices

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import INVITE_ROLE_SCHEMA, INVITE_STATUS_SCHEMA
from ..members.schema import ROLE_CHOICES_PAYLOAD_ENUM


class InvitedByUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InvitedByUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA


class InviteesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InviteesField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class InvitePatchRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.invites.serializers.InvitePatchPayload'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'status',
                    ],
                    properties={
                        'status': INVITE_STATUS_SCHEMA,
                    },
                ),
                build_object_type(
                    required=[
                        'role',
                    ],
                    properties={
                        'role': INVITE_ROLE_SCHEMA,
                    },
                ),
            ]
        }


class InviteUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InviteUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-invites-detail',
            organization_id='orgR6zUBwMHop2mgGygtFd6c',
            guid='f3ba00b2-372b-4283-9d57-adbe7d5b1bf1',
        )


class InviteRoleFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InviteRoleField'

    def map_serializer_field(self, auto_schema, direction):
        return build_choice_field(
            field=serializers.ChoiceField(
                choices=ROLE_CHOICES_PAYLOAD_ENUM
            )
        )
