from django.conf import settings
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from rest_framework.reverse import reverse


# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
class AccessLogMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogMetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'Source': build_basic_type(OpenApiTypes.STR),
                'auth_type': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
                'initial_user_uid': build_basic_type(OpenApiTypes.STR),
                'initial_user_username': build_basic_type(OpenApiTypes.STR),
                'authorized_app_name': build_basic_type(OpenApiTypes.STR),
            },
        }


class AccessLogUserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AccessLogUserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        example_url = settings.KOBOFORM_URL + reverse(
            'api_v2:user-kpi-detail', kwargs={'username': 'bob'}
        )

        return {'type': 'string', 'format': 'url', 'example': example_url}
