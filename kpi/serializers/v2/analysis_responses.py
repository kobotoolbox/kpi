from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)
from kpi.models import AnalysisResponses


class AnalysisResponseSerializer(serializers.ModelSerializer):

    content = WritableJSONField()
    uid = serializers.CharField(required=False, read_only=True)
    asset = RelativePrefixHyperlinkedRelatedField(
        view_name='asset_detail',
        lookup_field='uid',
        read_only=True,
    )
    submission_id = serializers.IntegerField()
    date_created = serializers.DateTimeField(required=False)
    date_modified = serializers.DateTimeField(required=False)

    class Meta:
        model = AnalysisResponses
        lookup_field = 'uid'
        fields = (
            'uid',
            'submission_id',
            'content',
            'date_created',
            'date_modified',
            'asset',
        )
