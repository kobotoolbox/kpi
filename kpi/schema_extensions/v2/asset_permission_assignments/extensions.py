from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type

from .schema import (
    ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA,
    ASSET_PERMISSION_ASSIGNMENT_URL_SCHEMA,
    PERMISSION_ASSIGNMENT_LABEL_SCHEMA,
    PERMISSION_URL_SCHEMA,
)
from kpi.schema_extensions.v2.generic.schema import (USER_URL_SCHEMA)

class AssetPermissionAssignmentUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.AssetPermissionAssignmentUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_PERMISSION_ASSIGNMENT_URL_SCHEMA


class AssetPermissionUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.AssetPermissionUrlField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_URL_SCHEMA


class LabelFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.LabelField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_ASSIGNMENT_LABEL_SCHEMA


class AssetPartialPermissionAssignmentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.AssetPartialPermissionAssignmentField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'user': USER_URL_SCHEMA,
                'permission': PERMISSION_URL_SCHEMA,
                'partial_permission': ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA,
            }
        )


class AssetPermissionCreateAssignmentSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.serializers.PermissionAssignmentCreateRequest'  # noqa

    def map_serializer(self, auto_schema, direction):
        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'permission',
                        'user',
                    ],
                    additionalProperties=False,
                    properties={
                        'permission': PERMISSION_URL_SCHEMA,
                        'user': USER_URL_SCHEMA,
                    },
                ),
                build_object_type(
                    required=[
                        'partial_permission',
                        'permission',
                        'user',
                    ],
                    properties={
                        'partial_permission': ASSET_PARTIAL_PERMISSION_ASSIGNMENT_SCHEMA,  # noqa
                        'permission': PERMISSION_URL_SCHEMA,
                        'user': USER_URL_SCHEMA,
                    },
                ),
            ]
        }


class UserURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.UserURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
