from rest_framework import serializers


class CreatePayloadField(serializers.JSONField):
    pass


class DataUrlCSVField(serializers.URLField):
    pass


class DataUrlXLSXField(serializers.URLField):
    pass


class ExportSettingsField(serializers.JSONField):
    pass


class UpdatePayloadField(serializers.JSONField):
    pass


class UrlField(serializers.URLField):
    pass
