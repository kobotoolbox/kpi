from rest_framework import serializers

from kpi.fields import (
    ParentHyperlinkedRelated,
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField
)
from kpi.models.draft_nlp import DraftNLPModel


class DraftNLPSerializer(serializers.ModelSerializer):
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
    asset = RelativePrefixHyperlinkedRelatedField(
        view_name='asset-detail', lookup_field='uid', read_only=True)
    parent = ParentHyperlinkedRelated(
        lookup_field='uid',
        required=False,
        allow_null=True,
    )
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

