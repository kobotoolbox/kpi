from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
)

from .schema import XFORM_SCHEMA


class ContradictoryFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permissions.fields.ContradictoryField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=XFORM_SCHEMA)


class ImpliedFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permissions.fields.ImpliedField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=XFORM_SCHEMA)


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.permissions.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return XFORM_SCHEMA
