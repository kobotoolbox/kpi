from kpi.models import SurveyAsset
from kpi.models import Collection
from kpi.serializers import SurveyAssetSerializer, SurveyAssetListSerializer
from kpi.serializers import CollectionSerializer, CollectionListSerializer
from kpi.serializers import UserSerializer, UserListSerializer
from kpi.serializers import TagSerializer, TagListSerializer
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from rest_framework import permissions
from kpi.permissions import IsOwnerOrReadOnly
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
import markdown
import json
from rest_framework import (
    viewsets,
    renderers,
)
from itertools import chain
from rest_framework import status
from rest_framework.decorators import detail_route
from taggit.models import Tag
from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable
from kpi.renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    MdTableRenderer,
    XlsRenderer,
    EnketoPreviewLinkRenderer,
)


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.none()
    serializer_class = CollectionSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,
                          IsOwnerOrReadOnly,)
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_authenticated():
            return Collection.objects.filter(owner=self.request.user)
        else:
            return Collection.objects.none()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer

class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'name'

    def get_queryset(self, *args, **kwargs):
        user = self.request.user
        if user.is_authenticated():
            def _get_tags_on_items(content_type_name, avail_items):
                '''
                return all ids of tags which are tagged to items of the given content_type
                '''
                content_type_id = ContentType.objects.get(model=content_type_name).id
                ids = avail_items.values_list('id', flat=True)
                return Tag.objects.filter(taggit_taggeditem_items__object_id__in=ids,
                                        taggit_taggeditem_items__content_type_id=content_type_id).filter().distinct().values_list('id', flat=True)
            all_tag_ids = list(chain(
                                    _get_tags_on_items('collection', user.owned_collections.all()),
                                    _get_tags_on_items('surveyasset', user.survey_assets.all()),
                                    ))
            return Tag.objects.filter(id__in=all_tag_ids)
        else:
            return Tag.objects.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return TagListSerializer
        else:
            return TagSerializer

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    This viewset automatically provides `list` and `detail` actions.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'username'

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        else:
            return UserSerializer


from rest_framework.parsers import MultiPartParser

class XlsFormParser(MultiPartParser):
    pass

class SurveyAssetViewSet(viewsets.ModelViewSet):
    """
    This viewset automatically provides `list`, `create`, `retrieve`,
    `update` and `destroy` actions.

    Additionally we also provide an extra `highlight` action.
    """
    queryset = SurveyAsset.objects.all()
    serializer_class = SurveyAssetSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,
                          IsOwnerOrReadOnly,)
    lookup_field = 'uid'

    renderer_classes = (
                        renderers.BrowsableAPIRenderer,
                        AssetJsonRenderer,
                        SSJsonRenderer,
                        MdTableRenderer,
                        XFormRenderer,
                        XlsRenderer,
                        EnketoPreviewLinkRenderer,
                        )

    def get_serializer_class(self):
        if self.action == 'list':
            return SurveyAssetListSerializer
        else:
            return SurveyAssetSerializer

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_authenticated():
            return SurveyAsset.objects.filter(owner=self.request.user)
        else:
            return SurveyAsset.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa._to_ss_structure())
        return Response("<html><body><code><pre>%s</pre></code></body></html>" % md_table)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
