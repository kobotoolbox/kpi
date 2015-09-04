from itertools import chain
import copy
import json
import datetime

from django.contrib.auth.models import User
from django.db.models import Q, Count
from django.forms import model_to_dict
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import (
    viewsets,
    mixins,
    renderers,
    status,
)

from django.contrib.auth.decorators import login_required

from rest_framework import exceptions
from rest_framework.decorators import api_view
from rest_framework.decorators import renderer_classes
from rest_framework.decorators import detail_route
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.reverse import reverse
from taggit.models import Tag

from .filters import KpiAssignedObjectPermissionsFilter
from .filters import KpiObjectPermissionsFilter
from .filters import SearchFilter
from .highlighters import highlight_xform
from .models import (
    Collection,
    Asset,
    Asset,
    AssetSnapshot,
    ImportTask,
    AssetDeployment,
    ObjectPermission,)
from .models.object_permission import get_anonymous_user
from .models.asset_deployment import kobocat_url
from .permissions import (
    IsOwnerOrReadOnly,
    get_perm_name,
)
from .renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    AssetSnapshotXFormRenderer,
    XlsRenderer,)
from .serializers import (
    AssetSerializer, AssetListSerializer,
    AssetSnapshotSerializer,
    CollectionSerializer, CollectionListSerializer,
    UserSerializer, UserListSerializer,
    TagSerializer, TagListSerializer,
    AssetDeploymentSerializer,
    ImportTaskSerializer, ImportTaskListSerializer,
    ObjectPermissionSerializer,)
from .utils.gravatar_url import gravatar_url
from .utils.ss_structure_to_mdtable import ss_structure_to_mdtable
from .tasks import import_in_background


CLONE_ARG_NAME = 'clone_from'
ASSET_CLONE_FIELDS = {'name', 'content', 'asset_type'}
COLLECTION_CLONE_FIELDS = {'name'}


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
                         'server_time': str(datetime.datetime.utcnow()),
                         'projects_url': kobocat_url('/'),
                         'is_superuser': user.is_superuser,
                         'gravatar': gravatar_url(user.email),
                         'is_staff': user.is_staff,
                         'last_login': user.last_login,
                         })

@api_view(['GET'])
@renderer_classes([renderers.TemplateHTMLRenderer])
def home(request):
    return Response('ok', template_name="index.html")

@login_required
@api_view(['GET'])
@renderer_classes([renderers.TemplateHTMLRenderer])
def home(request):
    return Response('ok', template_name="index.html")


class NoUpdateModelViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet
):
    '''
    Inherit from everything that ModelViewSet does, except for
    UpdateModelMixin.
    '''
    pass


class ObjectPermissionViewSet(NoUpdateModelViewSet):
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
    queryset = Collection.objects.select_related(
        'owner', 'parent'
    ).prefetch_related(
        'permissions',
        'permissions__permission',
        'permissions__user',
        'permissions__content_object',
    ).all()
    serializer_class = CollectionSerializer
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, SearchFilter)
    lookup_field = 'uid'

    def _clone(self):
        # Clone an existing collection.
        original_uid = self.request.data[CLONE_ARG_NAME]
        original_collection= get_object_or_404(Collection, uid=original_uid)
        view_perm= get_perm_name('view', original_collection)
        if not self.request.user.has_perm(view_perm, original_collection):
            raise Http404
        else:
            # Copy the essential data from the original collection.
            original_data= model_to_dict(original_collection)
            cloned_data= {keep_field: original_data[keep_field]
                          for keep_field in COLLECTION_CLONE_FIELDS}
            if original_collection.tag_string:
                cloned_data['tag_string']= original_collection.tag_string

            # Pull any additionally provided parameters/overrides from the
            # request.
            for param in self.request.data:
                cloned_data[param]= self.request.data[param]
            serializer = self.get_serializer(data=cloned_data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED,
                            headers=headers)

    def create(self, request, *args, **kwargs):
        if CLONE_ARG_NAME not in request.data:
            return super(CollectionViewSet, self).create(request, *args,
                                                         **kwargs)
        else:
            return self._clone()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer


class AssetDeploymentViewSet(NoUpdateModelViewSet):
    queryset = AssetDeployment.objects.none()
    serializer_class = AssetDeploymentSerializer
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous():
            return AssetDeployment.objects.none()
        else:
            return AssetDeployment.objects.filter(user=self.request.user)


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
        if user.is_anonymous():
            user = get_anonymous_user()

        def _get_tags_on_items(content_type_name, avail_items):
            '''
            return all ids of tags which are tagged to items of the given
            content_type
            '''
            same_content_type = Q(
                taggit_taggeditem_items__content_type__model=content_type_name)
            same_id = Q(
                taggit_taggeditem_items__object_id__in=avail_items.
                values_list('id'))
            return Tag.objects.filter(same_content_type & same_id).distinct().\
                values_list('id', flat=True)
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


class XlsFormParser(MultiPartParser):
    pass


class ImportTaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportTask.objects.all()
    serializer_class = ImportTaskSerializer
    lookup_field = 'uid'

    def get_serializer_class(self):
        if self.action == 'list':
            return ImportTaskListSerializer
        else:
            return ImportTaskSerializer

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous():
            return ImportTask.objects.none()
        else:
            return ImportTask.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous():
            raise exceptions.NotAuthenticated()
        if 'base64Encoded' in request.POST:
            encoded_str = request.POST['base64Encoded']
            encoded_substr = encoded_str[encoded_str.index('base64') + 7:]
            import_task = ImportTask.objects.create(user=request.user, data={
                'base64Encoded': encoded_substr,
                'name': request.POST.get('name')
            })
            # Have Celery run the import in the background
            import_in_background.delay(import_task_uid=import_task.uid)
            return Response({
                'uid': import_task.uid,
                'status': ImportTask.PROCESSING
            }, status.HTTP_201_CREATED)


class AssetSnapshotViewSet(NoUpdateModelViewSet):
    serializer_class = AssetSnapshotSerializer
    lookup_field = 'uid'
    queryset = AssetSnapshot.objects.none()
    # permission_classes = (IsOwnerOrReadOnly,)

    renderer_classes = NoUpdateModelViewSet.renderer_classes + [
        AssetSnapshotXFormRenderer,
    ]

    def get_queryset(self):
        # The XML renderer IGNORES this and serves anyone, so
        # /asset_snapshot/valid_uid/.xml is world-readable, even though
        # /asset_snapshot/valid_uid/ requires ownership
        user = self.request.user
        if not user.is_anonymous():
            return AssetSnapshot.objects.filter(owner=user)
        else:
            return AssetSnapshot.objects.none()


class AssetViewSet(viewsets.ModelViewSet):
    """
    * Assign a asset to a collection <span class='label label-warning'>partially implemented</span>
    * Run a partial update of a asset <span class='label label-danger'>TODO</span>
    """
    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Asset.objects.select_related(
        'owner', 'parent'
    ).prefetch_related(
        'permissions',
        'permissions__permission',
        'permissions__user',
        'permissions__content_object',
        # Getting the tag_string is making one query per object, but
        # prefetch_related doesn't seem to help
    ).annotate(Count('assetdeployment')).all()
    serializer_class = AssetSerializer
    lookup_field = 'uid'
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, SearchFilter)

    renderer_classes = (renderers.BrowsableAPIRenderer,
                        AssetJsonRenderer,
                        SSJsonRenderer,
                        XFormRenderer,
                        XlsRenderer,
                        )

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        else:
            return AssetSerializer

    def get_queryset(self, *args, **kwargs):
        ''' Really temporary way to exclude a taxing field from the database
        query when the request instructs us to do so. '''
        queryset = super(AssetViewSet, self).get_queryset(*args, **kwargs)
        # See also AssetSerializer.get_fields()
        excludes = self.request.GET.get('exclude', '')
        excludes = excludes.split(',')
        if 'content' in excludes:
            queryset = queryset.defer('content')
        return queryset

    def _get_clone_serializer(self):
        original_uid= self.request.data[CLONE_ARG_NAME]
        original_asset= get_object_or_404(Asset, uid=original_uid)
        view_perm= get_perm_name('view', original_asset)
        if not self.request.user.has_perm(view_perm, original_asset):
            raise Http404
        else:
            # Copy the essential data from the original asset.
            original_data= model_to_dict(original_asset)
            cloned_data= {keep_field: original_data[keep_field]
                          for keep_field in ASSET_CLONE_FIELDS}
            if original_asset.tag_string:
                cloned_data['tag_string']= original_asset.tag_string
            # TODO: Duplicate permissions if a user is cloning their own asset.
#             if ('permissions' in original_data) and (self.request.user == original_asset.owner):
#                 raise NotImplementedError
            # Pull any additionally provided parameters/overrides from therequest.
            for param in self.request.data:
                cloned_data[param]= self.request.data[param]

            serializer = self.get_serializer(data=cloned_data)

            return serializer

    def create(self, request, *args, **kwargs):
        if CLONE_ARG_NAME in request.data:
            serializer= self._get_clone_serializer()
        else:
            serializer = self.get_serializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED,
                        headers=headers)

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
        return Response({'asset': asset, }, template_name='koboform.html')

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.to_ss_structure())
        return Response(md_table.strip())

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        asset = self.get_object()
        export = asset.get_export(regenerate=True)
        response_data = copy.copy(export.details)
        response_data['api_url'] = reverse('asset-detail', args=(asset.uid,), request=self.request)
        options = {
            'linenos': True,
            'full': True,
        }
        if export.xml != '':
            response_data['highlighted_xform'] = highlight_xform(export.xml, **options)
        return Response(response_data, template_name='highlighted_xform.html')

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
        See https://github.com/tomchristie/django-rest-framework/issues/1041#issuecomment-22709658.
        '''
        # If the request fails at an early stage, e.g. the user has no
        # model-level permissions, accepted_renderer won't be present.
        if hasattr(request, 'accepted_renderer'):
            # Check the class of the renderer instead of just looking at the
            # format, because we don't want to set Content-Disposition:
            # attachment on asset snapshot XML
            if (isinstance(request.accepted_renderer, XlsRenderer) or
                    isinstance(request.accepted_renderer, XFormRenderer)):
                response[
                    'Content-Disposition'
                ] = 'attachment; filename={}.{}'.format(
                    self.get_object().uid,
                    request.accepted_renderer.format
                )

        return super(AssetViewSet, self).finalize_response(
            request, response, *args, **kwargs)


def _wrap_html_pre(content):
    return "<!doctype html><html><body><code><pre>%s</pre></code></body></html>" % content
