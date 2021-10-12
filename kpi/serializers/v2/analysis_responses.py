from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)
from kpi.models import AnalysisResponses


class AnalysisResponseSerializer(serializers.ModelSerializer):

    content = WritableJSONField()
    uid = serializers.CharField(required=False, read_only=True)
    asset = serializers.SlugRelatedField(read_only=True, slug_field='uid')
    submission_id = serializers.IntegerField()
    date_created = serializers.DateTimeField(read_only=True)
    date_modified = serializers.DateTimeField(read_only=True)

    class Meta:
        model = AnalysisResponses
        lookup_field = 'submission_id'
        fields = (
            'uid',
            'submission_id',
            'content',
            'date_created',
            'date_modified',
            'asset',
        )
