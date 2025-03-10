# coding: utf-8
from rest_framework import serializers

from kpi.fields import ReadOnlyJSONField
from kpi.models import SubmissionExportTask


class ExportTaskSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='submissionexporttask-detail'
    )
    messages = ReadOnlyJSONField(required=False)
    data = ReadOnlyJSONField()

    class Meta:
        model = SubmissionExportTask
        fields = (
            'url',
            'status',
            'messages',
            'uid',
            'date_created',
            'last_submission_time',
            'result',
            'data',
        )
        extra_kwargs = {
            'status': {
                'read_only': True,
            },
            'uid': {
                'read_only': True,
            },
            'last_submission_time': {
                'read_only': True,
            },
            'result': {
                'read_only': True,
            },
        }
