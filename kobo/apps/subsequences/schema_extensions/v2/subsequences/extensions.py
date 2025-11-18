# This drf-extension made for the metadata field of AccessLog targets the external class
# and tells it what it should return when generating the schema.
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA, GENERIC_ARRAY_SCHEMA,
)
class SubsequenceParamsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.subsequences.schema_extensions.v2.subsequences.fields.AdvancedFeatureParamsField'  # noqa

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
