from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import BALANCE_FIELDS_SCHEMA


class BalancesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.BalancesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission': BALANCE_FIELDS_SCHEMA,
                'storage_bytes': BALANCE_FIELDS_SCHEMA,
                'asr_seconds': BALANCE_FIELDS_SCHEMA,
                'mt_characters': BALANCE_FIELDS_SCHEMA,
            }
        )


class NlpUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.NlpUsageField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'asr_seconds_current_period': build_basic_type(OpenApiTypes.INT),
                'mt_characters_current_period': build_basic_type(OpenApiTypes.INT),
                'asr_seconds_all_time': build_basic_type(OpenApiTypes.INT),
                'mt_characters_all_time': build_basic_type(OpenApiTypes.INT),
            }
        )


class SubmissionCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.SubmissionCountField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'all_time': build_basic_type(OpenApiTypes.INT),
                'current_period': build_basic_type(OpenApiTypes.INT),
            }
        )
