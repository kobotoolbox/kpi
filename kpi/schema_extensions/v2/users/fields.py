from rest_framework import serializers


class MetadataField(serializers.JSONField):
    pass


class UrlField(serializers.URLField):
    pass
