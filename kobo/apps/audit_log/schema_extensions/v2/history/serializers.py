from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ActionField,
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
