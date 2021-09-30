from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)
from kpi.models import AnalysisQuestions


class AnalysisQuestionsSerializer(serializers.ModelSerializer):

    uid = serializers.CharField()
    content = WritableJSONField()
    asset = serializers.SlugRelatedField(read_only=True, slug_field='uid')
    date_created = serializers.DateTimeField(required=False)
    date_modified = serializers.DateTimeField(required=False)

    class Meta:
        model = AnalysisQuestions
        lookup_field = 'uid'

        fields = (
            'uid',
            'content',
            'asset',
            'date_created',
            'date_modified',
        )
