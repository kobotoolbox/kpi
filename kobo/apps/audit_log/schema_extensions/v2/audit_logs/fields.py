from rest_framework import serializers


class AuditLogMetadataField(serializers.JSONField):
    pass


class ProjectHistoryMetadataField(serializers.JSONField):
    pass


class UserField(serializers.URLField):
    pass
