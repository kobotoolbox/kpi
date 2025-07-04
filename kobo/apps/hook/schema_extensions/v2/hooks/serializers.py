from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import PendingUidsField


HookRetryResponse = inline_serializer_class(
    name='HookRetryResponse',
    fields={'detail': serializers.CharField(), 'pending_uids': PendingUidsField()},
)
