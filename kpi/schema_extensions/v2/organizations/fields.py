from rest_framework import serializers


class AssetField(serializers.JSONField):
    pass


class AssetUsageField(serializers.JSONField):
    pass


class BalanceField(serializers.JSONField):
    pass


class MembersField(serializers.URLField):
    pass


class NlpUsageAllTime(serializers.JSONField):
    pass


class NlpUsageCurrentPeriod(serializers.JSONField):
    pass


class ServiceUsageField(serializers.URLField):
    pass


class TotalNlpUsageField(serializers.JSONField):
    pass


class TotalSubmissionCountField(serializers.JSONField):
    pass


class UrlField(serializers.URLField):
    pass
