from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
    build_choice_field,
)
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_ARRAY_SCHEMA,
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class InviteAssetFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.InviteAssetField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class InviteUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.InviteUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:project-ownership-invite-detail', uid='poi52fGkwDjQeZkUxcaou39q'
        )


class RecipientSenderUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.RecipientSenderUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA


class StatusEnumFieldExtension(OpenApiSerializerFieldExtension):
    CHOICES = [
      ('accepted', 'Accepted'),
      ('cancelled', 'Cancelled'),
      ('declined', 'Declined'),
      ('expired', 'Expired'),
      ('pending', 'Pending'),
      ('resent', 'Resent'),
    ]

    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.StatusEnumField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_choice_field(
            field=serializers.ChoiceField(
                choices=StatusEnumFieldExtension.CHOICES
            )
        )


class TransferFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.TransferField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'url': build_url_type(
                        'api_v2:project-ownership-transfer-detail',
                        parent_lookup_invite_uid='poi52fGkwDjQeZkUxcaou39q',
                        uid='pot54pTqM5qwKdZ4wnNdiwDY',
                    ),
                    'asset': ASSET_URL_SCHEMA,
                    'status': GENERIC_STRING_SCHEMA,
                    'error': GENERIC_STRING_SCHEMA,
                    'date_modified': build_basic_type(OpenApiTypes.DATETIME),
                }
            )
        )
