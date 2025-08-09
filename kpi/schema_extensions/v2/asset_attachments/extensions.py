from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from kpi.schema_extensions.v2.generic.schema import GENERIC_ARRAY_SCHEMA


class SubmissionRootIdFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_attachments.serializers.SubmissionRootIdField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA
