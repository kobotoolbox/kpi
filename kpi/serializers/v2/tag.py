from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET
from kpi.models import Asset, TagUid
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.tags.fields import ParentUrlField, TagUrlField
from kpi.utils.object_permission import get_database_user, get_objects_for_user


class TagSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    assets = serializers.SerializerMethodField()
    parent = serializers.SerializerMethodField()
    uid = serializers.ReadOnlyField(source='taguid.uid')
    permission_classes = (IsAuthenticated,)

    class Meta:
        model = Tag
        fields = ('name', 'url', 'assets', 'parent', 'uid')

    @extend_schema_field(ParentUrlField)
    def get_parent(self, obj):
        return reverse('tags-list', request=self.context.get('request', None))

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_assets(self, obj):
        request = self.context.get('request', None)
        accessible_assets = get_objects_for_user(request.user, PERM_VIEW_ASSET, Asset)
        assets_uids = accessible_assets.filter(tags=obj).values_list('uid', flat=True)
        return [
            reverse('asset-detail', args=(asset_uid,), request=request)
            for asset_uid in assets_uids
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
