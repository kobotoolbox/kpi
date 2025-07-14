from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class AssetField(serializers.SerializerMethodField):
    pass


class AssetUsageField(serializers.SerializerMethodField):
    pass


class BalanceField(serializers.JSONField):
    pass


class IsOwnerField(serializers.SerializerMethodField):
    pass


class MembersField(serializers.SerializerMethodField):
    pass


class RequestUserRoleField(serializers.SerializerMethodField):
    pass


class NlpUsageAllTime(serializers.JSONField):
    pass


class NlpUsageCurrentPeriod(serializers.JSONField):
    pass


class TotalNlpUsageField(serializers.JSONField):
    pass


class TotalSubmissionCountField(serializers.JSONField):
    pass


class ServiceUsageField(serializers.SerializerMethodField):
    pass


class UrlField(HyperlinkedIdentityField):
    pass

