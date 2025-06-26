from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .fields import (
    DataAttachmentField,
    DataBulkDeleteField,
    DataBulkUpdateField,
    DataBulkUpdateResultField,
    DataValidationStatusesPayloadField,
    EmptyListField,
    EmptyObjectField,
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
    name='DataBulkUpdateResponse',
    fields={
        'count': serializers.IntegerField(),
        'successes': serializers.IntegerField(),
        'failures': serializers.IntegerField(),
        'results': DataBulkUpdateResultField(),
    },
)

DataResponse = inline_serializer(
    name='DataResponse',
    fields={
        '_id': serializers.IntegerField(),
        'formhub/uuid': serializers.CharField(),
        'start': serializers.DateTimeField(),
        'end': serializers.DateTimeField(),
        'Question_A/Enter_your_question': serializers.CharField(),
        'Question_B': serializers.CharField(),
        '__version__': serializers.CharField(),
        'meta/instanceID': serializers.CharField(),
        '_xform_id_string': serializers.CharField(),
        '_uuid': serializers.CharField(),
        'meta/rootUuid': serializers.CharField(),
        '_attachments': DataAttachmentField(),
        '_status': serializers.CharField(),
        '_geolocation': EmptyListField(),
        '_submission_time': serializers.TimeField(),
        '_tags': EmptyListField(),
        'Notes': EmptyListField(),
        '_validation_status': EmptyObjectField(),
        '_submitted_by': serializers.CharField(),
    },
)

DataStatusesUpdate = inline_serializer(
    name='DataStatusesUpdate',
    fields={
        'detail': serializers.CharField(),
    },
)

DataValidationStatusUpdatePayload = inline_serializer(
    name='DataValidationStatusUpdatePayload',
    fields={
        'validation_status.uid': serializers.CharField(),
    },
)

DataValidationStatusUpdateResponse = inline_serializer(
    name='DataValidationStatusUpdateResponse',
    fields={
        'timestamp': serializers.TimeField(),
        'uid': serializers.CharField(),
        'by_whom': serializers.CharField(),
        'label': serializers.CharField(),
    },
)

DataValidationStatusesUpdatePayload = inline_serializer(
    name='DataValidationStatusesUpdatePayload',
    fields={
        'submission_ids': DataValidationStatusesPayloadField(),
        'validation_status.uid': serializers.CharField(),
    },
)
