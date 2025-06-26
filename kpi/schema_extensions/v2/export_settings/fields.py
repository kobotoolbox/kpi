from rest_framework import serializers


class ExportSettingsField(serializers.JSONField):
    pass


class DataUrlCSVField(serializers.URLField):
    pass


class DataUrlXLSXField(serializers.URLField):
    pass


class UrlField(serializers.URLField):
    pass
