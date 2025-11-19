# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type

from kpi.schema_extensions.v2.generic.schema import GENERIC_OBJECT_SCHEMA


class SubsequenceParamsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.subsequences.schema_extensions.v2.subsequences.fields.AdvancedFeatureParamsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=GENERIC_OBJECT_SCHEMA)
