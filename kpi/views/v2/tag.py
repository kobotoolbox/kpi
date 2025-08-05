from django.contrib.contenttypes.models import ContentType
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET
from kpi.filters import SearchFilter
from kpi.models import Asset
from kpi.serializers.v2.tag import TagListSerializer, TagSerializer
from kpi.utils.object_permission import get_database_user, get_objects_for_user
from kpi.utils.schema_extensions.markdown import read_md


@extend_schema(
    tags=['Tags']
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'tags/list.md'),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'tags/retrieve.md'),
    ),
)
class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'taguid__uid'
    filter_backends = (SearchFilter,)
    renderer_classes = [
        JSONRenderer,
    ]

    """
    Viewset for managing the current user's tags

    Available actions:
    - list                  → GET /api/v2/tags/
    - retrieve              → GET /api/v2/tags/{taguid__uid}/

    Documentation:
    - docs/api/v2/tags/list.md
    - docs/api/v2/tags/retrieve.md
    """


    def get_queryset(self, *args, **kwargs):
        user = get_database_user(self.request.user)
        accessible_asset_pks = get_objects_for_user(user, PERM_VIEW_ASSET, Asset).only(
            'pk'
        )
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
