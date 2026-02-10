from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    DataAttachmentsField,
    DataBulkDeleteField,
    DataBulkUpdatePayloadField,
    DataBulkUpdateResultField,
    DataSupplementalDetailsField,
    DataValidationPayloadField,
    DataValidationStatusField,
    DataSupplementalDetailsField,
    EnketoEditUrlField,
    EnketoViewUrlField,
    GeoLocationField,
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
        'formhub/uuid': serializers.CharField(
            required=False,
        ),
        '__version__': serializers.CharField(),
        'meta/instanceID': serializers.CharField(),
        'meta/rootUuid': serializers.CharField(),
        'meta/deprecatedID': serializers.CharField(
            required=False,
        ),
        '_xform_id_string': serializers.CharField(),
        '_uuid': serializers.CharField(),
        '_attachments': DataAttachmentsField(),
        '_status': serializers.CharField(),
        '_geolocation': GeoLocationField(),
        '_submission_time': serializers.DateTimeField(),
        '_tags': serializers.ListField(child=serializers.CharField()),
        '_notes': serializers.ListField(
            child=serializers.CharField(),
        ),
        '_validation_status': DataValidationStatusField(),
        '_submitted_by': serializers.CharField(),
        '_supplementalDetails': DataSupplementalDetailsField(required=False),
    },
)


DataResponseXMLFormhubSerializer = inline_serializer_class(
    name='DataResponseXMLFormhubSerializer',
    fields={
        'uuid': serializers.CharField(),
    },
)

DataResponseXMLGeoLocationSerializer = inline_serializer_class(
    name='DataResponseXMLGeoLocationSerializer',
    fields={
        'latitude': serializers.FloatField(),
        'longitude': serializers.FloatField(),
    },
)


DataResponseXMLMetaSerializer = inline_serializer_class(
    name='DataResponseXMLMetaSerializer',
    fields={
        'instanceID': serializers.CharField(),
        'deprecatedID': serializers.CharField(required=False),
    },
)


DataResponseXML = inline_serializer_class(
    name='DataResponseXML',
    fields={
        'formhub': DataResponseXMLFormhubSerializer(required=False),
        '__version__': serializers.CharField(),
        'meta': DataResponseXMLMetaSerializer(),
        '_geolocation': DataResponseXMLGeoLocationSerializer(),
    },
)


DataStatusesUpdate = inline_serializer_class(
    name='DataStatusesUpdate',
    fields={
        'detail': serializers.CharField(),
    },
)

DataSupplementPayload = inline_serializer_class(
    name='DataSupplementPayload',
    fields={
        '_version': serializers.CharField(),
        'question_name_xpath': serializers.JSONField(),
    },
)


DataSupplementResponse = inline_serializer_class(
    name='DataSupplementResponse',
    fields={
        '_version': serializers.CharField(),
        'question_name_xpath': serializers.JSONField(),
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
