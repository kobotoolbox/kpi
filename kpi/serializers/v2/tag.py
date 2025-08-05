from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse
from taggit.models import Tag

from kpi.models import Asset, TagUid
from kpi.schema_extensions.v2.tags.fields import ParentUrlField, TagUrlField


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    uid = serializers.ReadOnlyField(source='taguid.uid')

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'parent', 'uid')

    @extend_schema_field(ParentUrlField)
    def get_parent(self, obj):
        return reverse('tags-list', request=self.context.get('request', None))

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_assets(self, obj):
        request = self.context.get('request', None)
        return [
            reverse('asset-detail', args=(asset_uid,), request=request)
            for asset_uid in Asset.objects.values_list('uid', flat=True)
        ]

    @extend_schema_field(TagUrlField)
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
