from rest_framework import serializers


class ActionField(serializers.ListField):
    pass


class MetadataField(serializers.JSONField):
    pass


class UserUrlField(serializers.URLField):
    pass
