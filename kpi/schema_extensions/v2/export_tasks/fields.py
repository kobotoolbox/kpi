from rest_framework import serializers


class DataField(serializers.JSONField):
    pass


class FieldsField(serializers.ListField):
    pass


class MessageField(serializers.JSONField):
    pass


class ResultField(serializers.URLField):
    pass


class UpdatePayloadField():
    pass


class UrlExportField(serializers.URLField):
    pass
