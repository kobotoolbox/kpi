from rest_framework import serializers


class MetadataField(serializers.JSONField):
    pass


class UserField(serializers.URLField):
    pass
