from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetField,
    NlpUsageAllTime,
    NlpUsageCurrentPeriod,
    TotalNlpUsageField,
    TotalSubmissionCountField,
)
from ..service_usage.fields import BalancesField

OrganizationAssetUsageResponse = inline_serializer_class(
    name='OrganizationAssetUsageResponse',
    fields={
        'asset': AssetField(),
        'asset__name': serializers.CharField(),
        'nlp_usage_current_period': NlpUsageCurrentPeriod(),
        'nlp_usage_all_time': NlpUsageAllTime(),
        'storage_bytes': serializers.IntegerField(),
        'submission_count_current_period': serializers.IntegerField(),
        'submission_count_all_time': serializers.IntegerField(),
        'deployment_status': serializers.CharField(),
    },
)


OrganizationServiceUsageResponse = inline_serializer_class(
    name='OrganizationServiceUsageResponse',
    fields={
        'total_nlp_usage': TotalNlpUsageField(),
        'total_storage_bytes': serializers.IntegerField(),
        'total_submission_count': TotalSubmissionCountField(),
        'balances': BalancesField(),
        'current_period_start': serializers.DateTimeField(),
        'current_period_end': serializers.DateTimeField(),
        'last_updated': serializers.DateTimeField(),
    },
)


OrganizationPatchPayload = inline_serializer_class(
    name='OrganizationPatchPayload',
    fields={
        'name': serializers.CharField(),
        'website': serializers.CharField(),
        'organization_type': serializers.CharField(),
    },
)
