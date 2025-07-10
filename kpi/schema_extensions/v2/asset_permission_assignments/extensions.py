from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type

from .schema import (
    LABEL_FIELD,
    PARTIAL_PERMISSION,
    PERM_CHANGE_ASSET,
    URL_FIELD, USER_FIELD
)


class LabelFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.LabelField'

    def map_serializer_field(self, auto_schema, direction):
        return LABEL_FIELD


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
                        'permission': PERM_CHANGE_ASSET,
                        'user': USER_FIELD,
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
                        'permission': PERM_CHANGE_ASSET,
                        'user': USER_FIELD,
                    },
                ),
            ]
        }


class PartialPermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.PartialPermissionField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'user': USER_FIELD,
                'permission': PERM_CHANGE_ASSET,
                'partial_permission': PARTIAL_PERMISSION,
            }
        )


class PermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.asset_permission_assignments.fields.PermissionField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERM_CHANGE_ASSET


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return URL_FIELD


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_permission_assignments.fields.UserField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_FIELD
