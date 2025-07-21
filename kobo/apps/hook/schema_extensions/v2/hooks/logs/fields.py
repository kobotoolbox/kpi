from rest_framework import serializers


class HookLogURLField(serializers.SerializerMethodField):
    pass


class PendingUidsField(serializers.ListField):
    pass
