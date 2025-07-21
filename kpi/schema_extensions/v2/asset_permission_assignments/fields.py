from rest_framework import serializers


class AssetPermissionUrlField(serializers.URLField):
    pass


class LabelField(serializers.SerializerMethodField):
    pass


class PartialPermissionField(serializers.SerializerMethodField):
    pass


class AssetPermissionAssignmentUrlField(serializers.URLField):
    pass


class UserField(serializers.URLField):
    pass
