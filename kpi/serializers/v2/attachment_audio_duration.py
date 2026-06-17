from django.utils.translation import gettext_lazy as t
from rest_framework import serializers

# Upper bound chosen so that ~0.5 s/file stays well under nginx's 120 s timeout
AUDIO_DURATION_MAX_BATCH_SIZE = 200


class AttachmentAudioDurationRequestSerializer(serializers.Serializer):
    attachment_uids = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        help_text=t(
            'List of attachment UIDs whose audio duration to retrieve '
            f'(max {AUDIO_DURATION_MAX_BATCH_SIZE})'
        ),
    )

    def validate_attachment_uids(self, value):
        if len(value) > AUDIO_DURATION_MAX_BATCH_SIZE:
            raise serializers.ValidationError(
                t(
                    'Too many attachments requested. '
                    f'Maximum batch size is {AUDIO_DURATION_MAX_BATCH_SIZE}; '
                    f'you submitted {len(value)}.'
                )
            )
        return value


class AttachmentAudioDurationItemSerializer(serializers.Serializer):
    uid = serializers.CharField()
    seconds = serializers.IntegerField(allow_null=True)


class AttachmentAudioDurationResponseSerializer(serializers.Serializer):
    attachments = AttachmentAudioDurationItemSerializer(many=True)
    total = serializers.IntegerField()
