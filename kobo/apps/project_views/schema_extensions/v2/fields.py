from rest_framework import serializers


class AssetLanguageField(serializers.ListField):
    pass


class AssetSettingsField(serializers.JSONField):
    pass


class AssetsURLField(serializers.URLField):
    pass


class AssetsExportURLField(serializers.URLField):
    pass


class AssetDownloadField(serializers.ListField):
    pass


class ExportResponseResult(serializers.URLField):
    pass


class GenericListField(serializers.ListField):
    pass


class UserMetadataField(serializers.JSONField):
    pass


class UrlField(serializers.URLField):
    pass


class UserURLField(serializers.URLField):
    pass


class UserExportURLField(serializers.URLField):
    pass
