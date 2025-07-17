from rest_framework import serializers


class BalancesField(serializers.JSONField):
    pass


class NlpUsageField(serializers.JSONField):
    pass


class SubmissionCountField(serializers.JSONField):
    pass
