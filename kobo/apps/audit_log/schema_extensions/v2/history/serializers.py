from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ActionField,
    MetadataField,
    UserUrlField,
)

HistoryActionResponse = inline_serializer_class(
    name='HistoryActionResponse',
    fields={
        'actions': ActionField(),
    }
)

HistoryExportPayload = inline_serializer_class(
    name='historyExportPayload',
    fields={
        'notifyAboutError': serializers.BooleanField(),
    },
)

HistoryExportResponse = inline_serializer_class(
    name='historyExportResponse',
    fields={
        'status': serializers.CharField(),
    },
)

HistoryListResponse = inline_serializer_class(
    name = 'HistoryListResponse',
    fields={
        'user': UserUrlField(),
        'user_uid': serializers.CharField(),
        'username': serializers.CharField(),
        'action': serializers.CharField(),
        'metadata': MetadataField(),
        'date_created': serializers.DateTimeField(),
    }
)
