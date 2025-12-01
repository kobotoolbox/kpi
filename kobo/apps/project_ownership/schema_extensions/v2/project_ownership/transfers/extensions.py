from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type, build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    ASSET_URL_SCHEMA,
    GENERIC_STRING_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.transfers.fields.AssetUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class StatusesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.transfers.fields.StatusesField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'status': GENERIC_STRING_SCHEMA,
                    'status_type': GENERIC_STRING_SCHEMA,
                    'error': GENERIC_STRING_SCHEMA,
                }
            )
        )


class TransferUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_ownership.schema_extensions.v2.project_ownership.transfers.fields.TransferUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:project-ownership-transfer-detail',
            uid_invite='poi52fGkwDjQeZkUxcaou39q',
            uid_transfer='pot54pTqM5qwKdZ4wnNdiwDY',
        )
