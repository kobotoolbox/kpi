from rest_framework import serializers


class ImportUrlField(serializers.URLField):
    pass


class MessagesField(serializers.JSONField):
    pass
