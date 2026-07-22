from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes


class ErrorValidationSerializerExtension(OpenApiSerializerExtension):
    target_class = 'kpi.utils.schema_extensions.response.ErrorValidationSerializer'

    def map_serializer(self, auto_schema, direction):
        # Free-form mapping of field name -> list of error messages, matching
        # DRF's unwrapped serializer `ValidationError` payloads.
        return build_object_type(
            additionalProperties=build_array_type(
                schema=build_basic_type(OpenApiTypes.STR)
            )
        )
