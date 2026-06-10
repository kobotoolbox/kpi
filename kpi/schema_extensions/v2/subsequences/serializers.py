from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AdvancedFeatureActionField,
    AdvancedFeatureCreateResponseParamsField,
    AdvancedFeatureRequestParamsField,
    AdvancedFeatureResponseParamsField,
)

AdvancedFeatureResponse = inline_serializer_class(
    name='AdvancedFeatureResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureResponseParamsField(),
        'uid': serializers.CharField(),
    },
)

AdvancedFeatureCreateResponse = inline_serializer_class(
    name='AdvancedFeatureCreateResponse',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureCreateResponseParamsField(),
        'uid': serializers.CharField(),
    },
)

AdvancedFeaturePatchRequest = inline_serializer_class(
    name='AdvancedFeaturePatchRequest',
    fields={
        'action': AdvancedFeatureActionField(),
        'question_xpath': serializers.CharField(),
        'params': AdvancedFeatureRequestParamsField(),
    },
)

AdvancedFeaturePostRequest = inline_serializer_class(
    name='AdvancedFeaturePostRequest',
    fields={
        'question_xpath': serializers.CharField(),
        'action': AdvancedFeatureActionField(),
        'params': AdvancedFeatureRequestParamsField(),
    },
)


BULK_ACTION_STATUS_CHOICES = ['pending', 'in_progress', 'complete', 'cancelled']


class BulkActionStatusField(serializers.ChoiceField):
    def __init__(self, *args, **kwargs):
        super().__init__(
            choices=BULK_ACTION_STATUS_CHOICES,
            *args,
            **kwargs,
        )


class BulkActionSubmissionStatusField(serializers.ChoiceField):
    def __init__(self, *args, **kwargs):
        super().__init__(
            choices=['pending', 'in_progress', 'complete', 'cancelled', 'failed'],
            *args,
            **kwargs,
        )


class BulkActionActionIdField(serializers.ChoiceField):
    def __init__(self, *args, **kwargs):
        super().__init__(
            choices=[
                'automatic_google_transcription',
                'automatic_google_translation',
            ],
            *args,
            **kwargs,
        )


BulkActionUserResponse = inline_serializer_class(
    name='BulkActionUserResponse',
    fields={
        'username': serializers.CharField(),
    },
)

BulkActionSubmissionStatusResponse = inline_serializer_class(
    name='BulkActionSubmissionStatusResponse',
    fields={
        'uuid': serializers.CharField(),
        'status': BulkActionSubmissionStatusField(),
        'error': serializers.CharField(allow_null=True),
    },
)

BulkActionParamsRequest = inline_serializer_class(
    name='BulkActionParamsRequest',
    fields={
        'language': serializers.CharField(),
        'locale': serializers.CharField(required=False),
    },
)

BulkActionParamsResponse = inline_serializer_class(
    name='BulkActionParamsResponse',
    fields={
        'language': serializers.CharField(),
        'locale': serializers.CharField(required=False),
    },
)

BulkActionResponse = inline_serializer_class(
    name='BulkActionResponse',
    fields={
        'uid': serializers.CharField(),
        'status': BulkActionStatusField(),
        'action_id': BulkActionActionIdField(),
        'question_xpath': serializers.CharField(),
        'submission_uuids': serializers.ListField(child=serializers.CharField()),
        'submission_statuses': BulkActionSubmissionStatusResponse(many=True),
        'params': BulkActionParamsResponse(),
        'progress': serializers.IntegerField(min_value=0, max_value=100),
        'created_by': BulkActionUserResponse(),
        'date_created': serializers.DateTimeField(),
        'date_modified': serializers.DateTimeField(),
        'cancelled_by': BulkActionUserResponse(required=False, allow_null=True),
    },
)

BulkActionCreateResponse = inline_serializer_class(
    name='BulkActionCreateResponse',
    fields={
        **BulkActionResponse().get_fields(),
        'skipped_uuids': serializers.ListField(child=serializers.CharField()),
    },
)

BulkActionCreateRequest = inline_serializer_class(
    name='BulkActionCreateRequest',
    fields={
        'action_id': BulkActionActionIdField(),
        'question_xpath': serializers.CharField(),
        'submission_uuids': serializers.ListField(child=serializers.CharField()),
        'params': BulkActionParamsRequest(),
    },
)

BulkActionPatchRequest = inline_serializer_class(
    name='BulkActionPatchRequest',
    fields={
        'status': serializers.ChoiceField(choices=['cancelled']),
    },
)

BulkActionListResponse = extend_schema_serializer(many=False)(
    inline_serializer_class(
        name='BulkActionListResponse',
        fields={
            'count': serializers.IntegerField(),
            'next': serializers.CharField(required=False, allow_null=True),
            'previous': serializers.CharField(required=False, allow_null=True),
            'results': BulkActionResponse(many=True),
        },
    )
)
