from rest_framework import serializers


class AssetsURLField(serializers.URLField):
    pass


class AssetsExportURLField(serializers.URLField):
    pass


class ExportResponseResult(serializers.URLField):
    pass


class UrlField(serializers.URLField):
    pass


class UserURLField(serializers.URLField):
    pass


class UserExportURLField(serializers.URLField):
    pass

