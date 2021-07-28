# coding: utf-8
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET
from kpi.filters import SearchFilter
from kpi.models import Asset
from kpi.utils.object_permission import (
    get_database_user,
    get_objects_for_user,
)
from kpi.serializers import TagSerializer, TagListSerializer


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'taguid__uid'
    filter_backends = (SearchFilter,)

    def get_queryset(self, *args, **kwargs):
        user = get_database_user(self.request.user)
        accessible_asset_pks = get_objects_for_user(
            user, PERM_VIEW_ASSET, Asset
        ).only('pk')
        content_type = ContentType.objects.get_for_model(Asset)
        return Tag.objects.filter(
            taggit_taggeditem_items__content_type=content_type,
            taggit_taggeditem_items__object_id__in=[accessible_asset_pks],
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return TagListSerializer
        else:
            return TagSerializer
