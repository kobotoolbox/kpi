from rest_framework import serializers


class BalancesField(serializers.JSONField):
    pass


class NlpUsageField(serializers.JSONField):
    pass


class SubmissionCountField(serializers.JSONField):
    pass


class BalanceDataField(serializers.Field):
    """
    Represents service usage balance values.
    Returns a dict like:
    {
        "effective_limit": int,
        "balance_value": int,
        "balance_percent": int,
        "exceeded": int
    }
    """

    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        return value
