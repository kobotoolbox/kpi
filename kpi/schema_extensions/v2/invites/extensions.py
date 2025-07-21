from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class InviteesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InviteesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_basic_type(OpenApiTypes.STR)
        )


class InviteUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InviteUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-invites-detail',
            organization_id='orgR6zUBwMHop2mgGygtFd6c',
            guid='f3ba00b2-372b-4283-9d57-adbe7d5b1bf1'
        )


class InvitedByUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.invites.fields.InvitedByUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'user-kpi-detail',
            username='bob'
        )
