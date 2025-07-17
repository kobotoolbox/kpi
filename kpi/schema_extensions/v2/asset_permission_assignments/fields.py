from rest_framework import serializers


class LabelField(serializers.SerializerMethodField):
    pass


class PermissionField(serializers.URLField):
    pass


class PartialPermissionField(serializers.SerializerMethodField):
    pass


class AssetPermissionUrlField(serializers.URLField):
    pass


class UserField(serializers.URLField):
    pass
