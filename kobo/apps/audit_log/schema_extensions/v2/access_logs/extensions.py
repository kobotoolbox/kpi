from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)


# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
class AccessLogMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'test': GENERIC_STRING_SCHEMA,
            }
        )


class AccessLogUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogUserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
