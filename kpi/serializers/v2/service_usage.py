from rest_framework import serializers


class ServiceUsageSerializer(serializers.Serializer):

    payload = serializers.JSONField()

    class Meta:
        pass
