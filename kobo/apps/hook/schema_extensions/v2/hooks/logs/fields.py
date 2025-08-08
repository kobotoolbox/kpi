from rest_framework import serializers


class HookLogURLField(serializers.URLField):
    pass


class PendingUidsField(serializers.ListField):
    pass
