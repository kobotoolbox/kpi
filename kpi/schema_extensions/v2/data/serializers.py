from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    DataBulkDeleteField,
    DataBulkUpdateField,
    DataValidationStatusesPayloadField,
    DataBulkUpdateResultField
)


DataBulkDelete = inline_serializer(
    name='DataBulkDelete',
    fields={
        'payload': DataBulkDeleteField(),
    },
)

DataBulkUpdate = inline_serializer(
    name='DataBulkUpdate',
    fields={
        'submission_ids': DataBulkDeleteField(),
        'data': DataBulkUpdateField(),
    },
)

DataBulkUpdateResponse = inline_serializer(
    name="DataBulkUpdateResponse",
    fields={
        'count': serializers.IntegerField(),
        'successes': serializers.IntegerField(),
        'failures': serializers.IntegerField(),
        'results': DataBulkUpdateResultField()
    }
)

DataStatusesUpdate = inline_serializer(
    name='DataStatusesUpdate',
    fields={
        'detail': serializers.CharField(),
    }
)

DataValidationStatusUpdatePayload = inline_serializer(
    name='DataValidationStatusUpdatePayload',
    fields={
        'validation_status.uid': serializers.CharField(),
    },
)

DataValidationStatusUpdateResponse = inline_serializer(
    name= "DataValidationStatusUpdateResponse",
    fields={
        'timestamp': serializers.TimeField(),
        'uid': serializers.CharField(),
        'by_whom': serializers.CharField(),
        'label': serializers.CharField()
    }
)

DataValidationStatusesUpdatePayload = inline_serializer(
    name='DataValidationStatusesUpdatePayload',
    fields={
        'submission_ids': DataValidationStatusesPayloadField(),
        'validation_status.uid': serializers.CharField(),
    },
)
