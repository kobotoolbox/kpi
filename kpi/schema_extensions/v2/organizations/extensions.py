from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_NLP_ALL_TIME_OBJECT_SCHEMA,
    GENERIC_NLP_OBJECT_SCHEMA,
)
from kpi.schema_extensions.v2.service_usage.extensions import get_balance_data_ref
from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.AssetField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-assets',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class AssetUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.AssetUsageField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-asset-usage',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class BalanceFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.BalanceField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission': get_balance_data_ref(auto_schema),
                'storage_bytes': get_balance_data_ref(auto_schema),
                'asr_seconds': get_balance_data_ref(auto_schema),
                'mt_characters': get_balance_data_ref(auto_schema),
                'llm_requests': get_balance_data_ref(auto_schema),
            }
        )


class MembersFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.MembersField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-members-list',
            organization_id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class NlpUsageAllTimeExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.NlpUsageAllTime'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_OBJECT_SCHEMA


class NlpUsageCurrentPeriodExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.NlpUsageCurrentPeriod'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_OBJECT_SCHEMA


class ServiceUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.ServiceUsageField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-service-usage',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class TotalNlpUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.TotalNlpUsageField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_ALL_TIME_OBJECT_SCHEMA


class TotalSubmissionCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.TotalSubmissionCountField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'all_time': build_basic_type(OpenApiTypes.INT),
                'current_period': build_basic_type(OpenApiTypes.INT),
            }
        )


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-detail',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )
