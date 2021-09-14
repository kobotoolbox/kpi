from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField
)
from kpi.models.draft_nlp import DraftNLPModel


class DraftNLPSerializer(serializers.Serializer):
    TRANSCRIPT = 'transcript'
    TRANSLATION = 'translation'

    TYPE_CHOICES = (
        (TRANSCRIPT, TRANSCRIPT),
        (TRANSLATION, TRANSLATION),
        # Future
        # (CODING_QUESTIONS, CODING_QUESTIONS),
        # (CODING_RESPONSES, CODING_RESPONSES),
    )

    uid = serializers.CharField(required=False, read_only=True)
    draft_nlp_type = serializers.ChoiceField(choices=TYPE_CHOICES)
    asset = serializers.StringRelatedField(read_only=True)
    # parent = RelativePrefixHyperlinkedRelatedField(
    #     lookup_field='uid',
    #     queryset=DraftNLPModel.objects.filter(),
    #     view_name='data-nlp-list',
    #     required=False,
    #     allow_null=True,
    # )
    question_path = serializers.CharField(max_length=2048)
    submission_id = serializers.IntegerField()
    content = WritableJSONField()
    date_created = serializers.DateTimeField(required=False)
    date_modified = serializers.DateTimeField(required=False)

    class Meta:
        model = DraftNLPModel
        lookup_field = 'uid'

        fields = (
            'id',
            'content',
            'date_created',
            'date_modified',
            'draft_nlp_type',
            'question_path',
            'submission_id',
            'asset',
            'parent',
            'uid',
        )

    def update(self, draft_nlp, validated_data):
        return super().update(draft_nlp, validated_data)