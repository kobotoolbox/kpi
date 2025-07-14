from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AuditLogMetadataField,
    ProjectHistoryMetadataField,
    UserField,
)


AuditLogResponse = inline_serializer_class(
    name='AuditLogResponse',
    fields={
        'app_label': serializers.CharField(),
        'model_name': serializers.CharField(),
        'user': UserField(),
        'user_uid': serializers.CharField(),
        'username': serializers.CharField(),
        'action': serializers.CharField(),
        'metadata': AuditLogMetadataField(),
        'date_created': serializers.DateTimeField(),
        'log_type': serializers.CharField(),
    },
)


ProjectHistoryLogResponse = inline_serializer_class(
    name='ProjectHistoryLogResponse',
    fields={
        'user': UserField(),
        'user_uid': serializers.CharField(),
        'username': serializers.CharField(),
        'action': serializers.CharField(),
        'metadata': ProjectHistoryMetadataField(),
        'date_created': serializers.DateTimeField(),
    },
)
