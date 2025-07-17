from rest_framework import serializers


class CeleryTask(serializers.URLField):
    pass

class MetadataField(serializers.JSONField):
    pass
