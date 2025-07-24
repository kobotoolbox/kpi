# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse
from taggit.models import Tag

from kpi.models import Asset, TagUid
from kpi.utils.object_permission import get_database_user


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField('_get_tag_url', read_only=True)
    assets = serializers.SerializerMethodField('_get_assets', read_only=True)
    parent = serializers.SerializerMethodField(
        '_get_parent_url', read_only=True)
    uid = serializers.ReadOnlyField(source='taguid.uid')

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'parent', 'uid')

    def _get_parent_url(self, obj):
        return reverse('tag-list', request=self.context.get('request', None))

    def _get_assets(self, obj):
        request = self.context.get('request', None)
        user = get_database_user(request.user)
        return [reverse('asset-detail', args=(sa.uid,), request=request)
                for sa in Asset.objects.filter(tags=obj, owner=user).all()]

    def _get_tag_url(self, obj):
        request = self.context.get('request', None)
        uid = TagUid.objects.get_or_create(tag=obj)[0].uid
        return reverse('tag-detail', args=(uid,), request=request)


class TagListSerializer(TagSerializer):

    class Meta:
        model = Tag
        fields = ('name', 'url', )
