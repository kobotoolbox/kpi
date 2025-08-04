from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import BALANCE_FIELDS_SCHEMA


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
                'submission': BALANCE_FIELDS_SCHEMA,
                'storage_bytes': BALANCE_FIELDS_SCHEMA,
                'asr_seconds': BALANCE_FIELDS_SCHEMA,
                'mt_characters': BALANCE_FIELDS_SCHEMA,
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
        return build_object_type(
            properties={
                'total_nlp_asr_seconds': build_basic_type(OpenApiTypes.INT),
                'total_nlp_mt_characters': build_basic_type(OpenApiTypes.INT),
            }
        )


class NlpUsageCurrentPeriodExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.organizations.fields.NlpUsageCurrentPeriod'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'total_nlp_asr_seconds': build_basic_type(OpenApiTypes.INT),
                'total_nlp_mt_characters': build_basic_type(OpenApiTypes.INT),
            }
        )


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
        return build_object_type(
            properties={
                'asr_seconds_current_period': build_basic_type(OpenApiTypes.INT),
                'mt_characters_current_period': build_basic_type(OpenApiTypes.INT),
                'asr_seconds_all_time': build_basic_type(OpenApiTypes.INT),
                'mt_characters_all_time': build_basic_type(OpenApiTypes.INT),
            }
        )


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
