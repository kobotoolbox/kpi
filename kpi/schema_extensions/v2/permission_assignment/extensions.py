from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import (
    LABEL_FIELD,
    PERMISSION,
    PARTIAL_PERMISSION,
    URL_FIELD,
    USER_FIELD
)


class LabelFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.LabelField'

    def map_serializer_field(self, auto_schema, direction):
        return LABEL_FIELD


class PartialPermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.PartialPermissionField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'user': USER_FIELD,
                'permission':  PERMISSION,
                'partial_permission': PARTIAL_PERMISSION,
            }
        )


class PermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permission_assignment.fields.PermissionField'

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
