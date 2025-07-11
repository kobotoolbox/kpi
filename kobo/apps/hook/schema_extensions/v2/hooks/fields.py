from rest_framework import serializers


class LogsUrlField(serializers.SerializerMethodField):
    pass


class UrlField(serializers.SerializerMethodField):
    pass


class PendingUidsField(serializers.ListField):
    pass


class SettingsField(serializers.JSONField):
    pass


class SubsetFieldsField(serializers.ListField):
    pass
