import json
from itertools import chain

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import (
    viewsets,
    renderers,
    permissions,
    status,
)
from rest_framework.decorators import detail_route
from rest_framework.response import Response
from rest_framework.reverse import reverse
from taggit.models import Tag

from .models import (
    Collection,
    object_permission,
    SurveyAsset,)
from .models.object_permission import get_anonymous_user
from .permissions import IsOwnerOrReadOnly
from .filters import KpiObjectPermissionsFilter
from .highlighters import highlight_xform
from .renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    XlsRenderer,
    EnketoPreviewLinkRenderer,)
from .serializers import (
    SurveyAssetSerializer, SurveyAssetListSerializer,
    CollectionSerializer, CollectionListSerializer,
    UserSerializer, UserListSerializer,
    TagSerializer, TagListSerializer)
from .utils.ss_structure_to_mdtable import ss_structure_to_mdtable


class CollectionViewSet(viewsets.ModelViewSet):
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter,)
    lookup_field = 'uid'

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
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        def _get_tags_on_items(content_type_name, avail_items):
            '''
            return all ids of tags which are tagged to items of the given content_type
            '''
            same_content_type = Q(taggit_taggeditem_items__content_type__model=content_type_name)
            same_id = Q(taggit_taggeditem_items__object_id__in=avail_items.values_list('id'))
            return Tag.objects.filter(same_content_type & same_id).distinct().values_list('id', flat=True)
        all_tag_ids = list(chain(
                                _get_tags_on_items('collection', user.owned_collections.all()),
                                _get_tags_on_items('surveyasset', user.survey_assets.all()),
                                ))

        return Tag.objects.filter(id__in=all_tag_ids).distinct()

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
    * Access a summary list of all survey assets available to your user. <span class='label label-success'>complete</span>
    * Inspect individual survey assets <span class='label label-success'>complete</span>
    * Download a survey asset in a `.xls` or `.xml` format <span class='label label-success'>complete</span>
    * Tag a survey asset <span class='label label-success'>complete</span>
    * View a survey asset in a markdown spreadsheet or XML preview format <span class='label label-success'>complete</span>
    * Assign a survey asset to a collection <span class='label label-warning'>partially implemented</span>
    * View and manage permissions of a survey asset <span class='label label-danger'>TODO</span>
    * View previous versions of a survey asset <span class='label label-danger'>TODO</span>
    * Update all content of a survey asset <span class='label label-danger'>TODO</span>
    * Run a partial update of a survey asset <span class='label label-danger'>TODO</span>
    * Generate a link to a preview in enketo-express <span class='label label-danger'>TODO</span>
    * Create anonymous survey assets <span class='label label-danger'>TODO</span>
    """
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = SurveyAsset.objects.all()
    serializer_class = SurveyAssetSerializer
    lookup_field = 'uid'
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, )

    renderer_classes = (renderers.BrowsableAPIRenderer,
                        AssetJsonRenderer,
                        SSJsonRenderer,
                        XFormRenderer,
                        XlsRenderer,
                        EnketoPreviewLinkRenderer,
                        )

    def get_serializer_class(self):
        if self.action == 'list':
            return SurveyAssetListSerializer
        else:
            return SurveyAssetSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def content(self, request, *args, **kwargs):
        survey_asset = self.get_object()
        return Response(json.dumps(survey_asset.to_ss_structure()))

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def koboform(self, request, *args, **kwargs):
        survey_asset = self.get_object()
        return Response({'survey_asset': survey_asset,}, template_name='koboform.html')

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.to_ss_structure())
        header_links = '''
        <a href="../">Back</a> | <a href="../.xls">Download XLS file</a><br>'''
        return Response(_wrap_html_pre(header_links + md_table.strip()))

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        survey_asset = self.get_object()
        export = survey_asset.export
        title = '[%s] %s' % (self.request.user.username, reverse('surveyasset-detail', args=(survey_asset.uid,), request=self.request),)
        header_links = '''
        <a href="../">Back</a> | <a href="../.xml">Download XML file</a><br>'''
        footer = '\n<!-- kpi/views.py#footer -->\n'
        options = {
            'linenos': True,
            'full': True,
            'title': title,
            'header': header_links,
            'footer': footer,
        }
        return Response(highlight_xform(export.xml, **options))

    def perform_create(self, serializer):
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        user = self.request.user
        if user.is_anonymous():
            user = get_anonymous_user()
        serializer.save(owner=user)

def _wrap_html_pre(content):
    return "<!doctype html><html><body><code><pre>%s</pre></code></body></html>" % content
