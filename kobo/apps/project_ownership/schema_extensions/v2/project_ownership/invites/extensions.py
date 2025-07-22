from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type

class InviteAssetFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.InviteAssetField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_basic_type(OpenApiTypes.STR)
        )


class InviteUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.InviteUrlField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:project-ownership-invite-detail',
            uid='poi52fGkwDjQeZkUxcaou39q'
        )


class RecipientSenderUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.RecipientSenderUrlField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:user-kpi-detail',
            username='bob'
        )


class TransferFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields.TransferField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'url': build_url_type(
                        'api_v2:project-ownership-transfer-detail',
                        parent_lookup_invite_uid='poi52fGkwDjQeZkUxcaou39q',
                        uid='pot54pTqM5qwKdZ4wnNdiwDY',
                    ),
                    'asset': build_url_type(
                        'api_v2:asset-detail',
                        uid='a8rg3w7ZNL5Nwj7iHzKiyX'
                    ),
                    'status': build_basic_type(OpenApiTypes.STR),
                    'error': build_basic_type(OpenApiTypes.STR),
                    'date_modified': build_basic_type(OpenApiTypes.DATETIME),
                }
            )
        )
