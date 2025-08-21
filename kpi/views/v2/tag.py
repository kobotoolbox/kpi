from django.contrib.contenttypes.models import ContentType
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET
from kpi.filters import SearchFilter
from kpi.models import Asset
from kpi.schema_extensions.v2.tags.serializers import (
    TagListResponse,
    TagRetrieveResponse,
)
from kpi.serializers.v2.tag import TagListSerializer, TagSerializer
from kpi.utils.object_permission import get_database_user, get_objects_for_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(tags=['Tags'])
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'tags/list.md'),
        responses=open_api_200_ok_response(
            TagListResponse,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'tags/retrieve.md'),
        responses=open_api_200_ok_response(
            TagRetrieveResponse,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'taguid__uid'
    filter_backends = (SearchFilter,)

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
