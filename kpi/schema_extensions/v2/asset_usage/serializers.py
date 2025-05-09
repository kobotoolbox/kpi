from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    AssetUsageURLField,
    AssetUsageAllTimePeriodField,
    AssetUsageCurrentPeriodField
)

AssetSubscriptionPostRequestInlineSerializer = inline_serializer(
    name='AssetSubscriptionPostRequestInlineSerializer',
    fields={
        'asset_url': AssetUsageURLField(),
        'asset_name': serializers.CharField(),
        'nlp_usage_current_period': AssetUsageCurrentPeriodField(),
        'nlp_usage_all_time': AssetUsageAllTimePeriodField(),
        'storage_bytes': serializers.IntegerField(),
        'submission_count_current_period': serializers.IntegerField(),
        'submission_count_all_time': serializers.IntegerField(),
    },
)
