from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type, build_basic_type
from drf_spectacular.types import OpenApiTypes

from .schema import (
    PERMISSION_ASSIGNMENT_LABEL_FIELD,
    PARTIAL_PERMISSION,
    PERMISSION_ASSIGNMENT_CHANGE_ASSET,
    # PERMISSION_URL_FIELD,
    # PERMISSION_USER_FIELD,
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
                        'permission': PERMISSION_ASSIGNMENT_CHANGE_ASSET,
                        # 'user': PERMISSION_USER_FIELD,
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
                        'partial_permission': PARTIAL_PERMISSION,
                        'permission': PERMISSION_ASSIGNMENT_CHANGE_ASSET,
                        # 'user': PERMISSION_USER_FIELD,
                        'user': build_basic_type(OpenApiTypes.STR),
                    },
                ),
            ]
        }


class PartialPermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.PartialPermissionField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                # 'user': PERMISSION_USER_FIELD,
                'user': build_basic_type(OpenApiTypes.STR),
                'permission': PERMISSION_ASSIGNMENT_CHANGE_ASSET,
                'partial_permission': PARTIAL_PERMISSION,
            }
        )


class PermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.PermissionField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION_ASSIGNMENT_CHANGE_ASSET


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.UrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        # return PERMISSION_URL_FIELD
        return build_basic_type(OpenApiTypes.STR)


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.UserField'
    )

    def map_serializer_field(self, auto_schema, direction):
        # return PERMISSION_USER_FIELD
        return build_basic_type(OpenApiTypes.STR)
