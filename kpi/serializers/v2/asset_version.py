# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.models import AssetVersion


class AssetVersionListSerializer(serializers.Serializer):
    # If you change these fields, please update the `only()` and
    # `select_related()` calls  in `AssetVersionViewSet.get_queryset()`
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    content_hash = serializers.ReadOnlyField()
    date_deployed = serializers.SerializerMethodField(read_only=True)
    date_modified = serializers.CharField(read_only=True)

    def get_date_deployed(self, obj):
        return obj.deployed and obj.date_modified

    def get_url(self, obj):
        return reverse('asset-version-detail',
                       args=(obj.asset.uid, obj.uid),
                       request=self.context.get('request', None))


class AssetVersionSerializer(AssetVersionListSerializer):
    content = serializers.SerializerMethodField(read_only=True)

    def get_content(self, obj):
        return obj.version_content

    def get_version_id(self, obj):
        return obj.uid

    class Meta:
        model = AssetVersion
        fields = (
                    'version_id',
                    'date_deployed',
                    'date_modified',
                    'content_hash',
                    'content',
                  )
