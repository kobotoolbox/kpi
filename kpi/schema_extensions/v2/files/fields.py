from rest_framework import serializers


class AssetUrlField(serializers.URLField):
    pass


class ContentURlField(serializers.URLField):
    pass


class FileUrlField(serializers.URLField):
    pass


class MetadataField(serializers.JSONField):
    pass


class UserUrlField(serializers.URLField):
    pass
