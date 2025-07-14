from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class AssetField(serializers.SerializerMethodField):
    pass


class AssetUsageField(serializers.SerializerMethodField):
    pass


class IsOwnerField(serializers.SerializerMethodField):
    pass


class MembersField(serializers.SerializerMethodField):
    pass


class RequestUserRoleField(serializers.SerializerMethodField):
    pass


class ServiceUsageField(serializers.SerializerMethodField):
    pass


class UrlField(HyperlinkedIdentityField):
    pass

