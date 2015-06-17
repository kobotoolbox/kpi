import json
from itertools import chain

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import (
    viewsets,
    mixins,
    renderers,
    permissions,
    status,
)
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import detail_route
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework import exceptions
from taggit.models import Tag

from .models import (
    Collection,
    object_permission,
    Asset,
    ImportTask,
    AssetDeployment,
    ObjectPermission,)
from .models.object_permission import get_anonymous_user
from .permissions import IsOwnerOrReadOnly
from .filters import KpiObjectPermissionsFilter
from .filters import KpiAssignedObjectPermissionsFilter, ParentFilter
from .filters import SearchFilter
from .highlighters import highlight_xform
from .renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    XlsRenderer,
    EnketoPreviewLinkRenderer,)
from .serializers import (
    AssetSerializer, AssetListSerializer,
    CollectionSerializer, CollectionListSerializer,
    UserSerializer, UserListSerializer,
    TagSerializer, TagListSerializer,
    AssetDeploymentSerializer,
    ImportTaskSerializer,
    ObjectPermissionSerializer,)
from .utils.ss_structure_to_mdtable import ss_structure_to_mdtable

from rest_framework.decorators import api_view
from rest_framework.response import Response
from kpi.utils.gravatar_url import gravatar_url

@api_view(['GET'])
def current_user(request):
    user = request.user
    if user.is_anonymous():
        return Response({'message': 'user is not logged in'})
    else:
        return Response({'username': user.username,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                            'email': user.email,
                            'is_superuser': user.is_superuser,
                            'gravatar': gravatar_url(user.email),
                            'is_staff': user.is_staff,
                            'last_login': user.last_login,
                            })


class ObjectPermissionViewSet(
        # Inherit from everything that ModelViewSet does, except for
        # UpdateModelMixin
        mixins.CreateModelMixin,
        mixins.RetrieveModelMixin,
        mixins.DestroyModelMixin,
        mixins.ListModelMixin,
        viewsets.GenericViewSet
    ):
    queryset = ObjectPermission.objects.all()
    serializer_class = ObjectPermissionSerializer
    lookup_field = 'uid'
    filter_backends = (KpiAssignedObjectPermissionsFilter, )

    def _requesting_user_can_share(self, affected_object):
        share_permission = 'share_{}'.format(affected_object._meta.model_name)
        return affected_object.has_perm(self.request.user, share_permission)

    def perform_create(self, serializer):
        # Make sure the requesting user has the share_ permission on
        # the affected object
        affected_object = serializer.validated_data['content_object']
        if not self._requesting_user_can_share(affected_object):
            raise exceptions.PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        # Only directly-applied permissions may be modified; forbid deleting
        # permissions inherited from ancestors
        if instance.inherited:
            raise exceptions.MethodNotAllowed(
                self.request.method,
                detail='Cannot delete inherited permissions.'
            )
        # Make sure the requesting user has the share_ permission on
        # the affected object
        affected_object = instance.content_object
        if not self._requesting_user_can_share(affected_object):
            raise exceptions.PermissionDenied()
        instance.content_object.remove_perm(
            instance.user,
            instance.permission.codename
        )


class CollectionViewSet(viewsets.ModelViewSet):
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, ParentFilter, SearchFilter)
    lookup_field = 'uid'

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer

class AssetDeploymentViewset(viewsets.ReadOnlyModelViewSet):
    queryset = AssetDeployment.objects.none()
    serializer_class = AssetDeploymentSerializer
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous():
            return AssetDeployment.objects.none()
        else:
            return AssetDeployment.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        asset_uid = request.POST.get('asset[uid]')
        user = self.request.user
        asset = Asset.objects.get(uid=asset_uid)

        RANDOM_FORM_ID_INCREMENTOR = random.randint(1000,9999)
        deployment = AssetDeployment._create_if_possible(asset,
                                user, RANDOM_FORM_ID_INCREMENTOR)

        if 'error' in deployment:
            return Response(deployment, status=status.HTTP_400_BAD_REQUEST)
        else:
            serializer = self.get_serializer(data=deployment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


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
                                _get_tags_on_items('asset', user.assets.all()),
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

import random
import base64
from io import BytesIO
from pyxform.xls2json_backends import xls_to_dict

from django.forms.models import model_to_dict

class ImportTaskViewset(viewsets.ReadOnlyModelViewSet):
    queryset = ImportTask.objects.all()
    serializer_class = ImportTaskSerializer
    lookup_field = 'uid'

    # permission_classes = (IsOwnerOrReadOnly,)
    # user = models.ForeignKey('auth.User')
    # data = JSONField()
    # status = models.CharField(choices=STATUS_CHOICES, max_length=32, default=CREATED)
    # uid = models.CharField(max_length=UID_LENGTH, default='')
    # date_created = models.DateTimeField(auto_now_add=True)

    def create(self, request, *args, **kwargs):
        # this should probably go in the asset's create method
        if 'base64Encoded' in request.POST:
            encoded_str = request.POST['base64Encoded']
            encoded_substr = encoded_str[encoded_str.index('base64')+7:]
            decoded_str = base64.b64decode(encoded_substr)
            try:
                survey_dict = xls_to_dict(BytesIO(decoded_str))
            except Exception, e:
                raise Exception('could not parse xls submission')

            asset = Asset.objects.create(
                owner=self.request.user,
                content=survey_dict,
                name=request.POST.get('name')
            )
            data = AssetSerializer(asset, context={'request': request}).data
            return Response(data, status.HTTP_201_CREATED)

class AssetViewSet(viewsets.ModelViewSet):
    """
    * Download a asset in a `.xls` or `.xml` format <span class='label label-success'>complete</span>
    * View a asset in a markdown spreadsheet or XML preview format <span class='label label-success'>complete</span>
    * Assign a asset to a collection <span class='label label-warning'>partially implemented</span>
    * View previous versions of a asset <span class='label label-danger'>TODO</span>
    * Update all content of a asset <span class='label label-danger'>TODO</span>
    * Run a partial update of a asset <span class='label label-danger'>TODO</span>
    * Generate a link to a preview in enketo-express <span class='label label-danger'>TODO</span>
    """
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Asset.objects.select_related('owner', 'parent').prefetch_related(
        'permissions',
        'permissions__permission',
        'permissions__user',
        'permissions__content_object',
    ).all()
    serializer_class = AssetSerializer
    lookup_field = 'uid'
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, ParentFilter, SearchFilter)

    renderer_classes = (renderers.BrowsableAPIRenderer,
                        AssetJsonRenderer,
                        SSJsonRenderer,
                        XFormRenderer,
                        XlsRenderer,
                        EnketoPreviewLinkRenderer,
                        )

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        else:
            return AssetSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def content(self, request, *args, **kwargs):
        asset = self.get_object()
        return Response(json.dumps({
            'kind': 'asset.content',
            'uid': asset.uid,
            'data': asset.to_ss_structure()
            }))

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def koboform(self, request, *args, **kwargs):
        asset = self.get_object()
        return Response({'asset': asset,}, template_name='koboform.html')

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.to_ss_structure())
        return Response(md_table.strip())

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        asset = self.get_object()
        export = asset.export
        title = '[%s] %s' % (self.request.user.username, reverse('asset-detail', args=(asset.uid,), request=self.request),)
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

    def finalize_response(self, request, response, *args, **kwargs):
        ''' Manipulate the headers as appropriate for the requested format.
        See https://github.com/tomchristie/django-rest-framework/issues/1041#issuecomment-22709658. '''
        if request.accepted_renderer.format == 'xls':
            response[
                'Content-Disposition'
            ] = 'attachment; filename={}.xls'.format(self.get_object().uid)
        return super(AssetViewSet, self).finalize_response(
            request, response, *args, **kwargs)

def _wrap_html_pre(content):
    return "<!doctype html><html><body><code><pre>%s</pre></code></body></html>" % content
