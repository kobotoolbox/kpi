# coding: utf-8
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.fields import WritableJSONField
from kpi.models import Asset, AssetMetadata


class AssetMetadataSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    date_modified = serializers.CharField(read_only=True)
    settings = WritableJSONField()

    class Meta:
        model = AssetMetadata
        fields = (
            'uid',
            'url',
            'date_modified',
            'settings',
        )
        read_only_fields = (
            'uid',
            'url',
            'date_modified',
        )

    def get_url(self, obj):
        return reverse(
            'asset-metadata-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )
