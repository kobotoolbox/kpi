# coding: utf-8
from itertools import chain

from django.db.models import Q
from rest_framework import viewsets
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET, PERM_VIEW_COLLECTION
from kpi.filters import SearchFilter
from kpi.models import Asset, Collection
from kpi.models.object_permission import get_anonymous_user, get_objects_for_user
from kpi.serializers import TagSerializer, TagListSerializer


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'taguid__uid'
    filter_backends = (SearchFilter,)

    def get_queryset(self, *args, **kwargs):
        user = self.request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous:
            user = get_anonymous_user()

        def _get_tags_on_items(content_type_name, avail_items):
            """
            return all ids of tags which are tagged to items of the given
            content_type
            """
            same_content_type = Q(
                taggit_taggeditem_items__content_type__model=content_type_name)
            same_id = Q(
                taggit_taggeditem_items__object_id__in=avail_items.
                values_list('id'))
            return Tag.objects.filter(same_content_type & same_id).distinct().\
                values_list('id', flat=True)

        accessible_collections = get_objects_for_user(
            user, PERM_VIEW_COLLECTION, Collection).only('pk')
        accessible_assets = get_objects_for_user(
            user, PERM_VIEW_ASSET, Asset).only('pk')
        all_tag_ids = list(chain(
            _get_tags_on_items('collection', accessible_collections),
            _get_tags_on_items('asset', accessible_assets),
        ))

        return Tag.objects.filter(id__in=all_tag_ids).distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return TagListSerializer
        else:
            return TagSerializer
