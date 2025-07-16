from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type, build_basic_type
from drf_spectacular.types import OpenApiTypes

from .schema import (
    PERMISSION_ASSIGNMENT_LABEL_FIELD,
    PARTIAL_PERMISSION_SCHEMA,
    PERMISSION_ASSIGNMENT_URL_SCHEMA,
    USER_URL_SCHEMA,
    PERMISSION_URL_SCHEMA,
)


class LabelFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.LabelField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_ASSIGNMENT_LABEL_FIELD


class PermissionCreateSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.serializers.PermissionCreateRequest'  # noqa

    def map_serializer(self, auto_schema, direction):
        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'permission',
                        'user',
                    ],
                    properties={
                        'permission': PERMISSION_URL_SCHEMA,
                        'user': build_basic_type(OpenApiTypes.STR),
                    },
                ),
                build_object_type(
                    required=[
                        'partial_permission',
                        'permission',
                        'user',
                    ],
                    properties={
                        'partial_permission': PARTIAL_PERMISSION_SCHEMA,
                        'permission': PERMISSION_URL_SCHEMA,
                        'user': USER_URL_SCHEMA,
                    },
                ),
            ]
        }


class PartialPermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.PartialPermissionField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'user': USER_URL_SCHEMA,
                'permission': PERMISSION_URL_SCHEMA,
                'partial_permission': PARTIAL_PERMISSION_SCHEMA,
            }
        )


class PermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.PermissionField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_URL_SCHEMA


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.AssetPermissionUrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_ASSIGNMENT_URL_SCHEMA


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.UserField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
