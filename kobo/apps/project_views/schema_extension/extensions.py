from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
class ExportResponseResultExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.ExportResponseResult'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'serve_private_file',
            path='bob/exports/assets-bob-view_pvyHWBnzRw3GCJpFs6cMdem-2025-07-18T124015Z.csv'
        )

