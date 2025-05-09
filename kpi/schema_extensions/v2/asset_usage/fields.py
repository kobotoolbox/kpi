from rest_framework import serializers


class AssetUsageURLField(serializers.URLField):
    pass


class AssetUsageAllTimePeriodField(serializers.JSONField):
    pass


class AssetUsageCurrentPeriodField(serializers.JSONField):
    pass
