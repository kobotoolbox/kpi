from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    USER_URL_SCHEMA,
    GENERIC_STRING_SCHEMA,
)

# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
class AccessLogMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': GENERIC_STRING_SCHEMA,
                'auth_type': GENERIC_STRING_SCHEMA,
                'ip_address': GENERIC_STRING_SCHEMA,
                'initial_user_uid': GENERIC_STRING_SCHEMA,
                'initial_user_username': GENERIC_STRING_SCHEMA,
                'authorized_app_name': GENERIC_STRING_SCHEMA,
            }
        )


class AccessLogUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogUserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA
