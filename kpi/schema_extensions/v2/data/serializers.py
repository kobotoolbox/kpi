from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    DataAttachmentField,
    DataBulkDeleteField,
    DataBulkUpdatePayloadField,
    DataBulkUpdateResultField,
    DataValidationPayloadField,
    EmptyListField,
    EmptyObjectField,
    EnketoEditUrlField,
    EnketoViewUrlField,
)

DataBulkDelete = inline_serializer_class(
    name='DataBulkDelete',
    fields={
        'payload': DataBulkDeleteField(),
    },
)

DataBulkUpdate = inline_serializer_class(
    name='DataBulkUpdate',
    fields={
        'payload': DataBulkUpdatePayloadField(),
    },
)

DataBulkUpdateResponse = inline_serializer_class(
    name='DataBulkUpdateResponse',
    fields={
        'count': serializers.IntegerField(),
        'successes': serializers.IntegerField(),
        'failures': serializers.IntegerField(),
        'results': DataBulkUpdateResultField(),
    },
)

DataResponse = inline_serializer_class(
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
        '_submission_time': serializers.DateTimeField(),
        '_tags': EmptyListField(),
        'Notes': EmptyListField(),
        '_validation_status': EmptyObjectField(),
        '_submitted_by': serializers.CharField(),
    },
)

DataStatusesUpdate = inline_serializer_class(
    name='DataStatusesUpdate',
    fields={
        'detail': serializers.CharField(),
    },
)

DataValidationStatusUpdatePayload = inline_serializer_class(
    name='DataValidationStatusUpdatePayload',
    fields={
        'validation_status.uid': serializers.CharField(),
    },
)

DataValidationStatusUpdateResponse = inline_serializer_class(
    name='DataValidationStatusUpdateResponse',
    fields={
        'timestamp': serializers.DateTimeField(),
        'uid': serializers.CharField(),
        'by_whom': serializers.CharField(),
        'label': serializers.CharField(),
    },
)

DataValidationStatusesUpdatePayload = inline_serializer_class(
    name='DataValidationStatusesUpdatePayload',
    fields={
        'payload': DataValidationPayloadField(),
    },
)

EnketoEditResponse = inline_serializer_class(
    name='EnketoEditResponse',
    fields={
        'url': EnketoEditUrlField(),
        'version': serializers.CharField(),
    },
)

EnketoViewResponse = inline_serializer_class(
    name='EnketoViewResponse',
    fields={
        'url': EnketoViewUrlField(),
        'version': serializers.CharField(),
    },
)
