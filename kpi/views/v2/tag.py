from django.contrib.contenttypes.models import ContentType
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from taggit.models import Tag

from kpi.constants import PERM_VIEW_ASSET
from kpi.filters import SearchFilter
from kpi.models import Asset
from kpi.schema_extensions.v2.tags.serializers import TagListResponse
from kpi.serializers.v2.tag import TagListSerializer
from kpi.utils.object_permission import get_database_user, get_objects_for_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(tags=['Manage projects and library content'])
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
)
class TagViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagListSerializer
    filter_backends = (SearchFilter,)

    """
    Viewset for listing the tags attached to the assets viewable by the current
    user

    Available actions:
    - list                  → GET /api/v2/tags/

    Documentation:
    - docs/api/v2/tags/list.md
    """

    def get_queryset(self, *args, **kwargs):
        user = get_database_user(self.request.user)
        accessible_asset_pks = get_objects_for_user(user, PERM_VIEW_ASSET, Asset).only(
            'pk'
        )
        content_type = ContentType.objects.get_for_model(Asset)
        # `distinct()` is required to avoid duplication from the joins when a
        # tag is associated with multiple assets
        return Tag.objects.filter(
            taggit_taggeditem_items__content_type=content_type,
            taggit_taggeditem_items__object_id__in=accessible_asset_pks,
        ).distinct()
