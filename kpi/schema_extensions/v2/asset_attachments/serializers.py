from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import SubmissionRootIdField

AssetAttachmentBulkRequest = inline_serializer_class(
    name='AssetAttachmentBulkRequest',
    fields={
        'submission_root_uuids': SubmissionRootIdField(),
    },
)

AssetAttachmentAudioDurationRequest = inline_serializer_class(
    name='AssetAttachmentAudioDurationRequest',
    fields={
        'attachment_uids': serializers.ListField(
            child=serializers.CharField(),
            help_text='List of attachment UIDs whose audio duration to retrieve',
        ),
    },
)

AssetAttachmentAudioDurationItem = inline_serializer_class(
    name='AssetAttachmentAudioDurationItem',
    fields={
        'uid': serializers.CharField(),
        'seconds': serializers.IntegerField(allow_null=True),
    },
)

AssetAttachmentAudioDurationResponse = inline_serializer_class(
    name='AssetAttachmentAudioDurationResponse',
    fields={
        'attachments': AssetAttachmentAudioDurationItem(many=True),
        'total': serializers.IntegerField(),
    },
)
