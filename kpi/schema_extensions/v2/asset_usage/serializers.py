from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    AssetUsageAllTimePeriodField,
    AssetUsageCurrentPeriodField,
    AssetUsageURLField,
)

AssetUsageResponse = inline_serializer(
    name='AssetUsageResponse',
    fields={
        'asset': AssetUsageURLField(),
        'asset__name': serializers.CharField(),
        'nlp_usage_current_period': AssetUsageCurrentPeriodField(),
        'nlp_usage_all_time': AssetUsageAllTimePeriodField(),
        'storage_bytes': serializers.IntegerField(),
        'submission_count_current_period': serializers.IntegerField(),
        'submission_count_all_time': serializers.IntegerField(),
    },
)
