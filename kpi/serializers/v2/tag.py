from rest_framework import serializers
from rest_framework.reverse import reverse
from taggit.models import Tag

from kpi.models import Asset, TagUid


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    uid = serializers.ReadOnlyField(source='taguid.uid')

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'parent', 'uid')

    def get_parent(self, obj):
        return reverse('tags-list', request=self.context.get('request', None))

    def get_assets(self, obj):
        request = self.context.get('request', None)
        return [
            reverse('asset-detail', args=(asset_uid,), request=request)
            for asset_uid in Asset.objects.values_list('uid', flat=True)
        ]

    def get_url(self, obj):
        request = self.context.get('request', None)
        tag_uid, _ = TagUid.objects.get_or_create(tag=obj)
        return reverse('tags-detail', args=(tag_uid.uid,), request=request)


class TagListSerializer(TagSerializer):
    class Meta(TagSerializer.Meta):
        fields = (
            'name',
            'url',
        )
