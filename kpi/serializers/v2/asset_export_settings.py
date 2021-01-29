# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.models import AssetExportSettings
from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
    SerializerMethodFileField,
    WritableJSONField,
)


class AssetExportSettingsSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    name = serializers.CharField()
    date_created = serializers.CharField(read_only=True)
    date_modified = serializers.CharField(read_only=True)
    export_settings = WritableJSONField()

    def get_url(self, obj):
        return reverse(
            'asset-export-settings-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )

    class Meta:
        model = AssetExportSettings
        fields = (
            'uid',
            'url',
            'name',
            'date_created',
            'date_modified',
            'export_settings',
        )

