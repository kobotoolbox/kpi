from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import build_object_type

from .schema import LABEL_FIELD, PARTIAL_PERMISSION, PERMISSION, URL_FIELD, USER_FIELD


class LabelFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.LabelField'

    def map_serializer_field(self, auto_schema, direction):
        return LABEL_FIELD


class PermissionCreateSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.permission_assignment.serializers.PermissionCreateRequest'  # noqa

    def map_serializer(self, auto_schema, direction):
        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'permission',
                        'user',
                    ],
                    properties={
                        'permission': PERMISSION,
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
                        'permission': PERMISSION,
                        'user': USER_FIELD,
                    },
                ),
            ]
        }


class PartialPermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.PartialPermissionField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'user': USER_FIELD,
                'permission': PERMISSION,
                'partial_permission': PARTIAL_PERMISSION,
            }
        )


class PermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.permission_assignment.fields.PermissionField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return PERMISSION


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return URL_FIELD


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.UserField'

    def map_serializer_field(self, auto_schema, direction):
        return USER_FIELD
