from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import PendingUidsField

LogsRetryResponse = inline_serializer_class(
    name='LogsRetryResponse',
    fields={'detail': serializers.CharField(), 'pending_uids': PendingUidsField()},
)
