from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type


class SubmissionRootIdFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.asset_attachments.serializers.SubmissionRootIdField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema={})
