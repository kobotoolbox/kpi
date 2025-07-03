from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    DataField,
    FieldsField,
    MessageField,
    QueryField,
    ResultField,
    SubmissionsField,
    UrlExportField,
)

ExportCreatePayload = inline_serializer_class(
    name='ExportCreatePayload',
    fields={
        'fields': FieldsField(),
        'fields_from_all_version': serializers.BooleanField(),
        'group_sep': serializers.CharField(),
        'hierarchy_in_labels': serializers.BooleanField(),
        'include_media_url': serializers.BooleanField(),
        'lang': serializers.CharField(),
        'multiple_select': serializers.CharField(),
        'submissions_id': SubmissionsField(),
        'type': serializers.CharField(),
        'flatten': serializers.BooleanField(),
        'xls_types_as_text': serializers.BooleanField(),
        'query': QueryField(),
    },
)

ExportResponse = inline_serializer_class(
    name='ExportResponse',
    fields={
        'url': UrlExportField(),
        'status': serializers.CharField(),
        'message': MessageField(),
        'uid': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
        'last_submission_time': serializers.DateTimeField(),
        'result': ResultField(),
        'data': DataField(),
    },
)
