from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    MetadataField,
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
        'metadata': MetadataField(),
        'date_created': serializers.DateTimeField(),
        'log_type': serializers.CharField(),
    },
)
