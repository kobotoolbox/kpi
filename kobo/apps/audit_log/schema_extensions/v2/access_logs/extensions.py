from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes

# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
class AccessLogMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'source': build_basic_type(OpenApiTypes.STR),
                'auth_type': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
                'user_id': build_basic_type(OpenApiTypes.STR),
                'username': build_basic_type(OpenApiTypes.STR),
                'app_name': build_basic_type(OpenApiTypes.STR),
            }
        }
