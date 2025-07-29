# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse
from taggit.models import Tag

from kpi.models import Asset, TagUid


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField('_get_tag_url', read_only=True)
    assets = serializers.SerializerMethodField('_get_assets', read_only=True)
    parent = serializers.SerializerMethodField('_get_parent_url', read_only=True)
    uid = serializers.ReadOnlyField(source='taguid.uid')

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'parent', 'uid')

    def _get_parent_url(self, obj):
        return reverse('tags-list', request=self.context.get('request', None))

    def _get_assets(self, obj):
        request = self.context.get('request', None)
        return [
            reverse('asset-detail', args=(sa.uid,), request=request)
            for sa in Asset.objects.values_list('uid', flat=True)
        ]

    def _get_tag_url(self, obj):
        request = self.context.get('request', None)
        tag_uid, _ = TagUid.objects.get_or_create(tag=obj)
        return reverse('tags-detail', args=(tag_uid.uid,), request=request)


class TagListSerializer(TagSerializer):
    class Meta:
        model = Tag
        fields = (
            'name',
            'url',
        )
