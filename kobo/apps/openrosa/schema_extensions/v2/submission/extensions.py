from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA


class SubmissionMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.openrosa.schema_extensions.v2.submission.fields.SubmissionMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'id': GENERIC_STRING_SCHEMA,
                'instanceID': GENERIC_STRING_SCHEMA,
                'submissionDate': build_basic_type(OpenApiTypes.DATETIME),
                'markedAsCompleteDate': build_basic_type(OpenApiTypes.DATETIME),
                'isComplete': build_basic_type(OpenApiTypes.BOOL),
            }
        )
