# coding: utf-8
from rest_framework import serializers
from kpi.fields import ReadOnlyJSONField
from kpi.models import ImportTask


class ImportTaskSerializer(serializers.HyperlinkedModelSerializer):
    messages = ReadOnlyJSONField(required=False)

    class Meta:
        model = ImportTask
        fields = (
            'status',
            'uid',
            'messages',
            'date_created',
        )
        extra_kwargs = {
            'uid': {
                'read_only': True,
            },
        }


class ImportTaskListSerializer(ImportTaskSerializer):
    url = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='importtask-detail'
    )
    messages = ReadOnlyJSONField(required=False)

    class Meta(ImportTaskSerializer.Meta):
        fields = (
            'url',
            'status',
            'messages',
            'uid',
            'date_created',
        )

