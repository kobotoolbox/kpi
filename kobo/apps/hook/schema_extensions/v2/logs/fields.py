from rest_framework import serializers


class UrlField(serializers.SerializerMethodField):
    pass


class PendingUidsField(serializers.ListField):
    pass
