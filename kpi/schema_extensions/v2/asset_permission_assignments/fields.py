from rest_framework import serializers


class AssetPermissionAssignmentUrlField(serializers.URLField):
    pass


class AssetPermissionUrlField(serializers.URLField):
    pass


class LabelField(serializers.SerializerMethodField):
    pass


class AssetPartialPermissionAssignmentField(serializers.SerializerMethodField):
    pass


class UserURLField(serializers.URLField):
    pass
