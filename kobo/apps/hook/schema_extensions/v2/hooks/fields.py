from rest_framework import serializers


class LogsUrlField(serializers.URLField):
    pass


class UrlField(serializers.URLField):
    pass


class PendingUidsField(serializers.ListField):
    pass


class SettingsField(serializers.JSONField):
    pass


class SubsetFieldsField(serializers.ListField):
    pass
