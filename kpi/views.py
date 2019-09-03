# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

import base64
import copy
import datetime
import json
from hashlib import md5
from itertools import chain

import constance

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.forms import model_to_dict
from django.http import Http404, HttpResponseBadRequest, HttpResponseRedirect
from django.shortcuts import get_object_or_404, resolve_url
from django.template.response import TemplateResponse
from django.utils.http import is_safe_url
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from private_storage.views import PrivateStorageDetailView
from rest_framework import exceptions, mixins, renderers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    detail_route,
    list_route
)
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.views import APIView
from rest_framework_extensions.mixins import NestedViewSetMixin
from taggit.models import Tag

from hub.models import SitewideMessage
from kobo.apps.hook.utils import HookUtils
from kobo.static_lists import COUNTRIES, LANGUAGES, SECTORS
from kpi.exceptions import BadAssetTypeException
from kpi.utils.log import logging
from .constants import (
    ASSET_TYPES,
    ASSET_TYPE_ARG_NAME,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    CLONE_ARG_NAME,
    CLONE_COMPATIBLE_TYPES,
    CLONE_FROM_VERSION_ID_ARG_NAME,
    COLLECTION_CLONE_FIELDS,
)
from .deployment_backends.backends import DEPLOYMENT_BACKENDS
from .filters import (
    AssetOwnerFilterBackend,
    KpiAssignedObjectPermissionsFilter,
    KpiObjectPermissionsFilter,
    RelatedAssetPermissionsFilter,
    SearchFilter
)
from .highlighters import highlight_xform
from .model_utils import disable_auto_field_update, remove_string_prefix
from .models import (
    Asset,
    AssetFile,
    AssetSnapshot,
    AssetVersion,
    AuthorizedApplication,
    Collection,
    ExportTask,
    ImportTask,
    ObjectPermission,
    OneTimeAuthenticationKey,
    UserCollectionSubscription
)
from .models.authorized_application import ApplicationTokenAuthentication
from .models.import_export_task import _resolve_url_to_asset_or_collection
from .models.object_permission import get_anonymous_user, get_objects_for_user
from .permissions import (
    IsOwnerOrReadOnly,
    PostMappedToChangePermission,
    get_perm_name,
    SubmissionsPermissions
)
from .renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    XMLRenderer,
    SubmissionXMLRenderer,
    XlsRenderer,
)
from .serializers import (
    AssetFileSerializer,
    AssetListSerializer,
    AssetSerializer,
    AssetSnapshotSerializer,
    AssetVersionListSerializer,
    AssetVersionSerializer,
    AuthorizedApplicationUserSerializer,
    CollectionListSerializer,
    CollectionSerializer,
    CreateUserSerializer,
    CurrentUserSerializer,
    DeploymentSerializer,
    ExportTaskSerializer,
    ImportTaskListSerializer,
    ImportTaskSerializer,
    ObjectPermissionSerializer,
    OneTimeAuthenticationKeySerializer,
    SitewideMessageSerializer,
    TagListSerializer,
    TagSerializer,
    UserCollectionSubscriptionSerializer,
    UserSerializer
)
from .tasks import import_in_background, export_in_background
from .utils.kobo_to_xlsform import to_xlsform_structure
from .utils.ss_structure_to_mdtable import ss_structure_to_mdtable


@login_required
def home(request):
    return TemplateResponse(request, "index.html")


def browser_tests(request):
    return TemplateResponse(request, "browser_tests.html")


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

    def _requesting_user_can_share(self, affected_object, codename):
        r"""
            Return `True` if `self.request.user` is allowed to grant and revoke
            `codename` on `affected_object`. For `Collection`, this is always
            the same as checking that `self.request.user` has the
            `share_collection` permission on `affected_object`. For `Asset`,
            the result is determined by either `share_asset` or
            `share_submissions`, depending on the `codename`.
            :type affected_object: :py:class:Asset or :py:class:Collection
            :type codename: str
            :rtype bool
        """
        model_name = affected_object._meta.model_name
        if model_name == 'asset' and codename.endswith('_submissions'):
            share_permission = 'share_submissions'
        else:
            share_permission = 'share_{}'.format(model_name)
        return affected_object.has_perm(self.request.user, share_permission)

    def perform_create(self, serializer):
        # Make sure the requesting user has the share_ permission on
        # the affected object
        with transaction.atomic():
            affected_object = serializer.validated_data['content_object']
            codename = serializer.validated_data['permission'].codename
            if not self._requesting_user_can_share(affected_object, codename):
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
        with transaction.atomic():
            affected_object = instance.content_object
            codename = instance.permission.codename
            if not self._requesting_user_can_share(affected_object, codename):
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
        'usercollectionsubscription_set',
    ).all().order_by('-date_modified')
    serializer_class = CollectionSerializer
    permission_classes = (IsOwnerOrReadOnly,)
    filter_backends = (KpiObjectPermissionsFilter, SearchFilter)
    lookup_field = 'uid'

    def _clone(self):
        # Clone an existing collection.
        original_uid = self.request.data[CLONE_ARG_NAME]
        original_collection = get_object_or_404(Collection, uid=original_uid)
        view_perm = get_perm_name('view', original_collection)
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
                cloned_data[param] = self.request.data[param]
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

    def perform_update(self, serializer, *args, **kwargs):
        ''' Only the owner is allowed to change `discoverable_when_public` '''
        original_collection = self.get_object()
        if (self.request.user != original_collection.owner and
                'discoverable_when_public' in serializer.validated_data and
                (serializer.validated_data['discoverable_when_public'] !=
                    original_collection.discoverable_when_public)
        ):
            raise exceptions.PermissionDenied()

        # Some fields shouldn't affect the modification date
        FIELDS_NOT_AFFECTING_MODIFICATION_DATE = set((
            'discoverable_when_public',
        ))
        changed_fields = set()
        for k, v in serializer.validated_data.iteritems():
            if getattr(original_collection, k) != v:
                changed_fields.add(k)
        if changed_fields.issubset(FIELDS_NOT_AFFECTING_MODIFICATION_DATE):
            with disable_auto_field_update(Collection, 'date_modified'):
                return super(CollectionViewSet, self).perform_update(
                    serializer, *args, **kwargs)

        return super(CollectionViewSet, self).perform_update(
                serializer, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.delete_with_deferred_indexing()

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        else:
            return CollectionSerializer


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

        accessible_collections = get_objects_for_user(
            user, 'view_collection', Collection).only('pk')
        accessible_assets = get_objects_for_user(
            user, 'view_asset', Asset).only('pk')
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


class UserViewSet(viewsets.GenericViewSet, mixins.RetrieveModelMixin):
    """
    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'username'

    def __init__(self, *args, **kwargs):
        super(UserViewSet, self).__init__(*args, **kwargs)
        self.authentication_classes += [ApplicationTokenAuthentication]

    def list(self, request, *args, **kwargs):
        raise exceptions.PermissionDenied()


class CurrentUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user


class AuthorizedApplicationUserViewSet(mixins.CreateModelMixin,
                                       viewsets.GenericViewSet):
    authentication_classes = [ApplicationTokenAuthentication]
    queryset = User.objects.all()
    serializer_class = CreateUserSerializer
    lookup_field = 'username'
    def create(self, request, *args, **kwargs):
        if type(request.auth) is not AuthorizedApplication:
            # Only specially-authorized applications are allowed to create
            # users via this endpoint
            raise exceptions.PermissionDenied()
        return super(AuthorizedApplicationUserViewSet, self).create(
            request, *args, **kwargs)


@api_view(['POST'])
@authentication_classes([ApplicationTokenAuthentication])
def authorized_application_authenticate_user(request):
    ''' Returns a user-level API token when given a valid username and
    password. The request header must include an authorized application key '''
    if type(request.auth) is not AuthorizedApplication:
        # Only specially-authorized applications are allowed to authenticate
        # users this way
        raise exceptions.PermissionDenied()
    serializer = AuthorizedApplicationUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        raise exceptions.PermissionDenied()
    if not user.is_active or not user.check_password(password):
        raise exceptions.PermissionDenied()
    token = Token.objects.get_or_create(user=user)[0]
    response_data = {'token': token.key}
    user_attributes_to_return = (
        'username',
        'first_name',
        'last_name',
        'email',
        'is_staff',
        'is_active',
        'is_superuser',
        'last_login',
        'date_joined'
    )
    for attribute in user_attributes_to_return:
        response_data[attribute] = getattr(user, attribute)
    return Response(response_data)


class OneTimeAuthenticationKeyViewSet(
        mixins.CreateModelMixin,
        viewsets.GenericViewSet
):
    authentication_classes = [ApplicationTokenAuthentication]
    queryset = OneTimeAuthenticationKey.objects.none()
    serializer_class = OneTimeAuthenticationKeySerializer
    def create(self, request, *args, **kwargs):
        if type(request.auth) is not AuthorizedApplication:
            # Only specially-authorized applications are allowed to create
            # one-time authentication keys via this endpoint
            raise exceptions.PermissionDenied()
        return super(OneTimeAuthenticationKeyViewSet, self).create(
            request, *args, **kwargs)


@require_POST
@csrf_exempt
def one_time_login(request):
    ''' If the request provides a key that matches a OneTimeAuthenticationKey
    object, log in the User specified in that object and redirect to the
    location specified in the 'next' parameter '''
    try:
        key = request.POST['key']
    except KeyError:
        return HttpResponseBadRequest(_('No key provided'))
    try:
        next_ = request.GET['next']
    except KeyError:
        next_ = None
    if not next_ or not is_safe_url(url=next_, host=request.get_host()):
        next_ = resolve_url(settings.LOGIN_REDIRECT_URL)
    # Clean out all expired keys, just to keep the database tidier
    OneTimeAuthenticationKey.objects.filter(
        expiry__lt=datetime.datetime.now()).delete()
    with transaction.atomic():
        try:
            otak = OneTimeAuthenticationKey.objects.get(
                key=key,
                expiry__gte=datetime.datetime.now()
            )
        except OneTimeAuthenticationKey.DoesNotExist:
            return HttpResponseBadRequest(_('Invalid or expired key'))
        # Nevermore
        otak.delete()
    # The request included a valid one-time key. Log in the associated user
    user = otak.user
    user.backend = settings.AUTHENTICATION_BACKENDS[0]
    login(request, user)
    return HttpResponseRedirect(next_)


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
            return ImportTask.objects.filter(
                        user=self.request.user).order_by('date_created')

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous():
            raise exceptions.NotAuthenticated()
        itask_data = {
            'library': request.POST.get('library') not in ['false', False],
            # NOTE: 'filename' here comes from 'name' (!) in the POST data
            'filename': request.POST.get('name', None),
            'destination': request.POST.get('destination', None),
        }
        if 'base64Encoded' in request.POST:
            encoded_str = request.POST['base64Encoded']
            encoded_substr = encoded_str[encoded_str.index('base64') + 7:]
            itask_data['base64Encoded'] = encoded_substr
        elif 'file' in request.data:
            encoded_xls = base64.b64encode(request.data['file'].read())
            itask_data['base64Encoded'] = encoded_xls
            if 'filename' not in itask_data:
                itask_data['filename'] = request.data['file'].name
        elif 'url' in request.POST:
            itask_data['single_xls_url'] = request.POST['url']
        import_task = ImportTask.objects.create(user=request.user,
                                                data=itask_data)
        # Have Celery run the import in the background
        import_in_background.delay(import_task_uid=import_task.uid)
        return Response({
            'uid': import_task.uid,
            'url': reverse(
                'importtask-detail',
                kwargs={'uid': import_task.uid},
                request=request),
            'status': ImportTask.PROCESSING
        }, status.HTTP_201_CREATED)


class ExportTaskViewSet(NoUpdateModelViewSet):
    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous():
            return ExportTask.objects.none()

        queryset = ExportTask.objects.filter(
            user=self.request.user).order_by('date_created')

        # Ultra-basic filtering by:
        # * source URL or UID if `q=source:[URL|UID]` was provided;
        # * comma-separated list of `ExportTask` UIDs if
        #   `q=uid__in:[UID],[UID],...` was provided
        q = self.request.query_params.get('q', False)
        if not q:
            # No filter requested
            return queryset
        if q.startswith('source:'):
            q = remove_string_prefix(q, 'source:')
            # This is exceedingly crude... but support for querying inside
            # JSONField not available until Django 1.9
            queryset = queryset.filter(data__contains=q)
        elif q.startswith('uid__in:'):
            q = remove_string_prefix(q, 'uid__in:')
            uids = [uid.strip() for uid in q.split(',')]
            queryset = queryset.filter(uid__in=uids)
        else:
            # Filter requested that we don't understand; make it obvious by
            # returning nothing
            return ExportTask.objects.none()
        return queryset

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous():
            raise exceptions.NotAuthenticated()

        # Read valid options from POST data
        valid_options = (
            'type',
            'source',
            'group_sep',
            'lang',
            'hierarchy_in_labels',
            'fields_from_all_versions',
        )
        task_data = {}
        for opt in valid_options:
            opt_val = request.POST.get(opt, None)
            if opt_val is not None:
                task_data[opt] = opt_val
        # Complain if no source was specified
        if not task_data.get('source', False):
            raise exceptions.ValidationError(
                {'source': 'This field is required.'})
        # Get the source object
        source_type, source = _resolve_url_to_asset_or_collection(
            task_data['source'])
        # Complain if it's not an Asset
        if source_type != 'asset':
            raise exceptions.ValidationError(
                {'source': 'This field must specify an asset.'})
        # Complain if it's not deployed
        if not source.has_deployment:
            raise exceptions.ValidationError(
                {'source': 'The specified asset must be deployed.'})
        # Create a new export task
        export_task = ExportTask.objects.create(user=request.user,
                                                data=task_data)
        # Have Celery run the export in the background
        export_in_background.delay(export_task_uid=export_task.uid)
        return Response({
            'uid': export_task.uid,
            'url': reverse(
                'exporttask-detail',
                kwargs={'uid': export_task.uid},
                request=request),
            'status': ExportTask.PROCESSING
        }, status.HTTP_201_CREATED)


class AssetSnapshotViewSet(NoUpdateModelViewSet):
    serializer_class = AssetSnapshotSerializer
    lookup_field = 'uid'
    queryset = AssetSnapshot.objects.all()

    renderer_classes = NoUpdateModelViewSet.renderer_classes + [
        XMLRenderer,
    ]

    def filter_queryset(self, queryset):
        if (self.action == 'retrieve' and
                self.request.accepted_renderer.format == 'xml'):
            # The XML renderer is totally public and serves anyone, so
            # /asset_snapshot/valid_uid.xml is world-readable, even though
            # /asset_snapshot/valid_uid/ requires ownership. Return the
            # queryset unfiltered
            return queryset
        else:
            user = self.request.user
            owned_snapshots = queryset.none()
            if not user.is_anonymous():
                owned_snapshots = queryset.filter(owner=user)
            return owned_snapshots | RelatedAssetPermissionsFilter(
                ).filter_queryset(self.request, queryset, view=self)

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        '''
        This route will render the XForm into syntax-highlighted HTML.
        It is useful for debugging pyxform transformations
        '''
        snapshot = self.get_object()
        response_data = copy.copy(snapshot.details)
        options = {
            'linenos': True,
            'full': True,
        }
        if snapshot.xml != '':
            response_data['highlighted_xform'] = highlight_xform(snapshot.xml,
                                                                 **options)
        return Response(response_data, template_name='highlighted_xform.html')

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def preview(self, request, *args, **kwargs):
        snapshot = self.get_object()
        if snapshot.details.get('status') == 'success':
            preview_url = "{}{}?form={}".format(
                              settings.ENKETO_SERVER,
                              settings.ENKETO_PREVIEW_URI,
                              reverse(viewname='assetsnapshot-detail',
                                      format='xml',
                                      kwargs={'uid': snapshot.uid},
                                      request=request,
                                      ),
                            )
            return HttpResponseRedirect(preview_url)
        else:
            response_data = copy.copy(snapshot.details)
            return Response(response_data, template_name='preview_error.html')


class AssetFileViewSet(NestedViewSetMixin, NoUpdateModelViewSet):
    model = AssetFile
    lookup_field = 'uid'
    filter_backends = (RelatedAssetPermissionsFilter,)
    serializer_class = AssetFileSerializer

    def get_queryset(self):
        _asset_uid = self.get_parents_query_dict()['asset']
        _queryset = self.model.objects.filter(asset__uid=_asset_uid)
        return _queryset

    def perform_create(self, serializer):
        asset = Asset.objects.get(uid=self.get_parents_query_dict()['asset'])
        if not self.request.user.has_perm('change_asset', asset):
            raise exceptions.PermissionDenied()
        serializer.save(
            asset=asset,
            user=self.request.user
        )

    def perform_destroy(self, *args, **kwargs):
        asset = Asset.objects.get(uid=self.get_parents_query_dict()['asset'])
        if not self.request.user.has_perm('change_asset', asset):
            raise exceptions.PermissionDenied()
        return super(AssetFileViewSet, self).perform_destroy(*args, **kwargs)

    class PrivateContentView(PrivateStorageDetailView):
        model = AssetFile
        model_file_field = 'content'
        def can_access_file(self, private_file):
            return private_file.request.user.has_perm(
                'view_asset', private_file.parent_object.asset)

    @detail_route(methods=['get'])
    def content(self, *args, **kwargs):
        view = self.PrivateContentView.as_view(
            model=AssetFile,
            slug_url_kwarg='uid',
            slug_field='uid',
            model_file_field='content'
        )
        af = self.get_object()
        # TODO: simply redirect if external storage with expiring tokens (e.g.
        # Amazon S3) is used?
        #   return HttpResponseRedirect(af.content.url)
        return view(self.request, uid=af.uid)


class HookSignalViewSet(NestedViewSetMixin, viewsets.ViewSet):
    """
    ##
    This endpoint is only used to trigger asset's hooks if any.

    Tells the hooks to post an instance to external servers.
    <pre class="prettyprint">
    <b>POST</b> /assets/<code>{uid}</code>/hook-signal/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/hook-signal/


    > **Expected payload**
    >
    >        {
    >           "instance_id": {integer}
    >        }

    """
    parent_model = Asset

    def create(self, request, *args, **kwargs):
        """
        It's only used to trigger hook services of the Asset (so far).

        :param request:
        :return:
        """
        asset_uid = self.get_parents_query_dict().get("asset")
        asset = get_object_or_404(self.parent_model, uid=asset_uid)

        instance_id = request.data.get("instance_id")
        if instance_id is None:
            raise exceptions.ValidationError(
                {'instance_id': _('This field is required.')})

        instance = None
        try:
            instance = asset.deployment.get_submission(instance_id)
        except ValueError:
            raise Http404

        # Check if instance really belongs to Asset.
        if not (instance and
                instance.get(asset.deployment.INSTANCE_ID_FIELDNAME) == instance_id):
            raise Http404

        if HookUtils.call_services(asset, instance_id):
            # Follow Open Rosa responses by default
            response_status_code = status.HTTP_202_ACCEPTED
            response = {
                "detail": _(
                    "We got and saved your data, but may not have fully processed it. You should not try to resubmit.")
            }
        else:
            # call_services() refused to launch any task because this
            # instance already has a `HookLog`
            response_status_code = status.HTTP_409_CONFLICT
            response = {
                "detail": _(
                    "Your data for instance {} has been already submitted.".format(instance_id))
            }

        return Response(response, status=response_status_code)


class SubmissionViewSet(NestedViewSetMixin, viewsets.ViewSet):
    """
    ## List of submissions for a specific asset

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/
    </pre>

    By default, JSON format is used but XML format can be used too.
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions.xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/?format=xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset
    * `id` - is the unique identifier of a specific submission

    **It's not allowed to create submissions with `kpi`'s API**

    Retrieves current submission
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/
    </pre>

    It's also possible to specify the format.

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>.xml
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>.json
    </pre>

    or

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/<code>{id}</code>/?format=xml
    <b>GET</b> /assets/<code>{asset_uid}</code>/submissions/<code>{id}</code>/?format=json
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/

    Deletes current submission
    <pre class="prettyprint">
    <b>DELETE</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/


    Update current submission

    _It's not possible to update a submission directly with `kpi`'s API.
    Instead, it returns the link where the instance can be opened for editing._

    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/edit/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/edit/


    ### Validation statuses

    Retrieves the validation status of a submission.
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/validation_status/

    Update the validation of a submission
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{uid}</code>/submissions/<code>{id}</code>/validation_status/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/234/validation_status/

    > **Payload**
    >
    >        {
    >           "validation_status.uid": <validation_status>
    >        }

    where `<validation_status>` is a string and can be one of theses values:

        - `validation_status_approved`
        - `validation_status_not_approved`
        - `validation_status_on_hold`

    Bulk update
    <pre class="prettyprint">
    <b>PATCH</b> /assets/<code>{uid}</code>/submissions/validation_statuses/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/submissions/validation_statuses/

    > **Payload**
    >
    >        {
    >           "submissions_ids": [{integer}],
    >           "validation_status.uid": <validation_status>
    >        }


    ### CURRENT ENDPOINT
    """
    parent_model = Asset
    renderer_classes = (renderers.BrowsableAPIRenderer,
                        renderers.JSONRenderer,
                        SubmissionXMLRenderer
                        )
    permission_classes = (SubmissionsPermissions,)

    def _get_asset(self):
        asset_uid = self.get_parents_query_dict()['asset']
        asset = get_object_or_404(self.parent_model, uid=asset_uid)

        return asset

    def _get_deployment(self):
        """
        Returns the deployment for the asset specified by the request
        """
        asset = self._get_asset()

        if not asset.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset has not been deployed'))
        return asset.deployment

    def destroy(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        pk = kwargs.get("pk")
        json_response = deployment.delete_submission(pk, user=request.user)
        return Response(**json_response)

    @detail_route(methods=['GET'], renderer_classes=[renderers.JSONRenderer])
    def edit(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        json_response = deployment.get_submission_edit_url(pk, user=request.user, params=request.GET)
        return Response(**json_response)

    def list(self, request, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = request.GET.dict()
        # remove `format` from filters, it's redundant.
        filters.pop('format', None)
        # Do not allow requests to retrieve more than `SUBMISSION_LIST_LIMIT`
        # submissions at one time
        limit = filters.get('limit', settings.SUBMISSION_LIST_LIMIT)
        try:
            limit = int(limit)
        except ValueError:
            raise exceptions.ValidationError(
                {'limit': _('A valid integer is required')}
            )
        filters['limit'] = min(limit, settings.SUBMISSION_LIST_LIMIT)
        submissions = deployment.get_submissions(format_type=format_type, **filters)
        return Response(list(submissions))

    def retrieve(self, request, pk, *args, **kwargs):
        format_type = kwargs.get('format', request.GET.get('format', 'json'))
        deployment = self._get_deployment()
        filters = request.GET.dict()
        # remove `format` from filters, it's redundant.
        filters.pop('format', None)
        submission = deployment.get_submission(pk, format_type=format_type, **filters)
        return Response(submission)

    @detail_route(methods=["GET", "PATCH"], renderer_classes=[renderers.JSONRenderer])
    def validation_status(self, request, pk, *args, **kwargs):
        deployment = self._get_deployment()
        if request.method == "PATCH":
            json_response = deployment.set_validation_status(pk, request.data, request.user)
        else:
            json_response = deployment.get_validation_status(pk, request.GET, request.user)

        return Response(**json_response)

    @list_route(methods=["PATCH"], renderer_classes=[renderers.JSONRenderer])
    def validation_statuses(self, request, *args, **kwargs):
        deployment = self._get_deployment()
        json_response = deployment.set_validation_statuses(request.data, request.user)

        return Response(**json_response)


class AssetVersionViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    model = AssetVersion
    lookup_field = 'uid'
    filter_backends = (
            AssetOwnerFilterBackend,
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetVersionListSerializer
        else:
            return AssetVersionSerializer

    def get_queryset(self):
        _asset_uid = self.get_parents_query_dict()['asset']
        _deployed = self.request.query_params.get('deployed', None)
        _queryset = self.model.objects.filter(asset__uid=_asset_uid)
        if _deployed is not None:
            _queryset = _queryset.filter(deployed=_deployed)
        if self.action == 'list':
            # Save time by only retrieving fields from the DB that the
            # serializer will use
            _queryset = _queryset.only(
                'uid', 'deployed', 'date_modified', 'asset_id')
        # `AssetVersionListSerializer.get_url()` asks for the asset UID
        _queryset = _queryset.select_related('asset__uid')
        return _queryset


class AssetViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """
    * Assign a asset to a collection <span class='label label-warning'>partially implemented</span>
    * Run a partial update of a asset <span class='label label-danger'>TODO</span>

    <span class='label label-danger'>TODO</span> Complete documentation

    ## List of asset endpoints

    Lists the asset endpoints accessible to requesting user, for anonymous access
    a list of public data endpoints is returned.

    <pre class="prettyprint">
    <b>GET</b> /assets/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/

    Get an hash of all `version_id`s of assets.
    Useful to detect any changes in assets with only one call to `API`

    <pre class="prettyprint">
    <b>GET</b> /assets/hash/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/hash/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset

    Retrieves current asset
    <pre class="prettyprint">
    <b>GET</b> /assets/<code>{uid}</code>/
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/

    Creates or clones an asset.
    <pre class="prettyprint">
    <b>POST</b> /assets/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/


    > **Payload to create a new asset**
    >
    >        {
    >           "name": {string},
    >           "settings": {
    >               "description": {string},
    >               "sector": {string},
    >               "country": {string},
    >               "share-metadata": {boolean}
    >           },
    >           "asset_type": {string}
    >        }

    > **Payload to clone an asset**
    >
    >       {
    >           "clone_from": {string},
    >           "name": {string},
    >           "asset_type": {string}
    >       }

    where `asset_type` must be one of these values:

    * block (can be cloned to `block`, `question`, `survey`, `template`)
    * question (can be cloned to `question`, `survey`, `template`)
    * survey (can be cloned to `block`, `question`, `survey`, `template`)
    * template (can be cloned to `survey`, `template`)

    Settings are cloned only when type of assets are `survey` or `template`.
    In that case, `share-metadata` is not preserved.

    When creating a new `block` or `question` asset, settings are not saved either.

    ### Deployment

    Retrieves the existing deployment, if any.
    <pre class="prettyprint">
    <b>GET</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Creates a new deployment, but only if a deployment does not exist already.
    <pre class="prettyprint">
    <b>POST</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Updates the `active` field of the existing deployment.
    <pre class="prettyprint">
    <b>PATCH</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment

    Overwrites the entire deployment, including the form contents, but does not change the deployment's identifier
    <pre class="prettyprint">
    <b>PUT</b> /assets/{uid}/deployment
    </pre>

    > Example
    >
    >       curl -X PUT https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/deployment


    ### Permissions
    Updates permissions of the specific asset
    <pre class="prettyprint">
    <b>PATCH</b> /assets/{uid}/permissions
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/permissions

    ### CURRENT ENDPOINT
    """

    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Asset.objects.all()

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
        queryset = super(AssetViewSet, self).get_queryset(*args, **kwargs)
        if self.action == 'list':
            return queryset.model.optimize_queryset_for_list(queryset)
        else:
            # This is called to retrieve an individual record. How much do we
            # have to care about optimizations for that?
            return queryset

    def _get_clone_serializer(self, current_asset=None):
        """
        Gets the serializer from cloned object
        :param current_asset: Asset. Asset to be updated.
        :return: AssetSerializer
        """
        original_uid = self.request.data[CLONE_ARG_NAME]
        original_asset = get_object_or_404(Asset, uid=original_uid)
        if CLONE_FROM_VERSION_ID_ARG_NAME in self.request.data:
            original_version_id = self.request.data.get(CLONE_FROM_VERSION_ID_ARG_NAME)
            source_version = get_object_or_404(
                original_asset.asset_versions, uid=original_version_id)
        else:
            source_version = original_asset.asset_versions.first()

        view_perm = get_perm_name('view', original_asset)
        if not self.request.user.has_perm(view_perm, original_asset):
            raise Http404

        partial_update = isinstance(current_asset, Asset)
        cloned_data = self._prepare_cloned_data(original_asset, source_version, partial_update)
        if partial_update:
            return self.get_serializer(current_asset, data=cloned_data, partial=True)
        else:
            return self.get_serializer(data=cloned_data)

    def _prepare_cloned_data(self, original_asset, source_version, partial_update):
        """
        Some business rules must be applied when cloning an asset to another with a different type.
        It prepares the data to be cloned accordingly.

        It raises an exception if source and destination are not compatible for cloning.

        :param original_asset: Asset
        :param source_version: AssetVersion
        :param partial_update: Boolean
        :return: dict
        """
        if self._validate_destination_type(original_asset):
            # `to_clone_dict()` returns only `name`, `content`, `asset_type`,
            # and `tag_string`
            cloned_data = original_asset.to_clone_dict(version=source_version)

            # Allow the user's request data to override `cloned_data`
            cloned_data.update(self.request.data.items())

            if partial_update:
                # Because we're updating an asset from another which can have another type,
                # we need to remove `asset_type` from clone data to ensure it's not updated
                # when serializer is initialized.
                cloned_data.pop("asset_type", None)
            else:
                # Change asset_type if needed.
                cloned_data["asset_type"] = self.request.data.get(ASSET_TYPE_ARG_NAME, original_asset.asset_type)

            cloned_asset_type = cloned_data.get("asset_type")
            # Settings are: Country, Description, Sector and Share-metadata
            # Copy settings only when original_asset is `survey` or `template`
            # and `asset_type` property of `cloned_data` is `survey` or `template`
            # or None (partial_update)
            if cloned_asset_type in [None, ASSET_TYPE_TEMPLATE, ASSET_TYPE_SURVEY] and \
                original_asset.asset_type in [ASSET_TYPE_TEMPLATE, ASSET_TYPE_SURVEY]:

                settings = original_asset.settings.copy()
                settings.pop("share-metadata", None)

                cloned_data_settings = cloned_data.get("settings", {})

                # Depending of the client payload. settings can be JSON or string.
                # if it's a string. Let's load it to be able to merge it.
                if not isinstance(cloned_data_settings, dict):
                    cloned_data_settings = json.loads(cloned_data_settings)

                settings.update(cloned_data_settings)
                cloned_data['settings'] = json.dumps(settings)

            # until we get content passed as a dict, transform the content obj to a str
            # TODO, verify whether `Asset.content.settings.id_string` should be cleared out.
            cloned_data["content"] = json.dumps(cloned_data.get("content"))
            return cloned_data
        else:
            raise BadAssetTypeException("Destination type is not compatible with source type")

    def _validate_destination_type(self, original_asset_):
        """
        Validates if destination asset can be cloned from source asset.
        :param original_asset_ Asset: Source
        :return: Boolean
        """
        is_valid = True

        if CLONE_ARG_NAME in self.request.data and ASSET_TYPE_ARG_NAME in self.request.data:
            destination_type = self.request.data.get(ASSET_TYPE_ARG_NAME)
            if destination_type in dict(ASSET_TYPES).values():
                source_type = original_asset_.asset_type
                is_valid = destination_type in CLONE_COMPATIBLE_TYPES.get(source_type)
            else:
                is_valid = False

        return is_valid

    def create(self, request, *args, **kwargs):
        if CLONE_ARG_NAME in request.data:
            serializer = self._get_clone_serializer()
        else:
            serializer = self.get_serializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED,
                        headers=headers)

    @list_route(methods=["GET"], renderer_classes=[renderers.JSONRenderer])
    def hash(self, request):
        """
        Creates an hash of `version_id` of all accessible assets by the user.
        Useful to detect changes between each request.

        :param request:
        :return: JSON
        """
        user = self.request.user
        if user.is_anonymous():
            raise exceptions.NotAuthenticated()
        else:
            accessible_assets = get_objects_for_user(
                user, "view_asset", Asset).filter(asset_type=ASSET_TYPE_SURVEY)\
                .order_by("uid")

            assets_version_ids = [asset.version_id for asset in accessible_assets if asset.version_id is not None]
            # Sort alphabetically
            assets_version_ids.sort()

            if len(assets_version_ids) > 0:
                hash = md5("".join(assets_version_ids)).hexdigest()
            else:
                hash = ""

            return Response({
                "hash": hash
            })

    @detail_route(renderer_classes=[renderers.JSONRenderer])
    def content(self, request, uid):
        asset = self.get_object()
        return Response({
            'kind': 'asset.content',
            'uid': asset.uid,
            'data': asset.to_ss_structure(),
        })

    @detail_route(renderer_classes=[renderers.JSONRenderer])
    def valid_content(self, request, uid):
        asset = self.get_object()
        return Response({
            'kind': 'asset.valid_content',
            'uid': asset.uid,
            'data': to_xlsform_structure(asset.content),
        })

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def koboform(self, request, *args, **kwargs):
        asset = self.get_object()
        return Response({'asset': asset, }, template_name='koboform.html')

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.ordered_xlsform_content())
        return Response('<!doctype html>\n'
                        '<html><body><code><pre>' + md_table.strip())

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    @detail_route(renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        asset = self.get_object()
        export = asset._snapshot(regenerate=True)
        # TODO-- forward to AssetSnapshotViewset.xform
        response_data = copy.copy(export.details)
        options = {
            'linenos': True,
            'full': True,
        }
        if export.xml != '':
            response_data['highlighted_xform'] = highlight_xform(export.xml, **options)
        return Response(response_data, template_name='highlighted_xform.html')

    @detail_route(
        methods=['get', 'post', 'patch'],
        permission_classes=[PostMappedToChangePermission]
    )
    def deployment(self, request, uid):
        '''
        A GET request retrieves the existing deployment, if any.
        A POST request creates a new deployment, but only if a deployment does
            not exist already.
        A PATCH request updates the `active` field of the existing deployment.
        A PUT request overwrites the entire deployment, including the form
            contents, but does not change the deployment's identifier
        '''
        asset = self.get_object()
        serializer_context = self.get_serializer_context()
        serializer_context['asset'] = asset

        # TODO: Require the client to provide a fully-qualified identifier,
        # otherwise provide less kludgy solution
        if 'identifier' not in request.data and 'id_string' in request.data:
            id_string = request.data.pop('id_string')[0]
            backend_name = request.data['backend']
            try:
                backend = DEPLOYMENT_BACKENDS[backend_name]
            except KeyError:
                raise KeyError(
                    'cannot retrieve asset backend: "{}"'.format(backend_name))
            request.data['identifier'] = backend.make_identifier(
                request.user.username, id_string)

        if request.method == 'GET':
            if not asset.has_deployment:
                raise Http404
            else:
                serializer = DeploymentSerializer(
                    asset.deployment, context=serializer_context
                )
                # TODO: Understand why this 404s when `serializer.data` is not
                # coerced to a dict
                return Response(dict(serializer.data))
        elif request.method == 'POST':
            if not asset.can_be_deployed:
                raise BadAssetTypeException("Only surveys may be deployed, but this asset is a {}".format(
                    asset.asset_type))
            else:
                if asset.has_deployment:
                    raise exceptions.MethodNotAllowed(
                        method=request.method,
                        detail='Use PATCH to update an existing deployment'
                        )
                serializer = DeploymentSerializer(
                    data=request.data,
                    context=serializer_context
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
                # TODO: Understand why this 404s when `serializer.data` is not
                # coerced to a dict
                return Response(dict(serializer.data))

        elif request.method == 'PATCH':
            if not asset.can_be_deployed:
                raise BadAssetTypeException("Only surveys may be deployed, but this asset is a {}".format(
                    asset.asset_type))
            else:
                if not asset.has_deployment:
                    raise exceptions.MethodNotAllowed(
                        method=request.method,
                        detail='Use POST to create a new deployment'
                    )
                serializer = DeploymentSerializer(
                    asset.deployment,
                    data=request.data,
                    context=serializer_context,
                    partial=True
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
                # TODO: Understand why this 404s when `serializer.data` is not
                # coerced to a dict
                return Response(dict(serializer.data))

    @detail_route(methods=["PATCH"], renderer_classes=[renderers.JSONRenderer])
    def permissions(self, request, uid):
        target_asset = self.get_object()
        source_asset = get_object_or_404(Asset, uid=request.data.get(CLONE_ARG_NAME))
        user = request.user
        response = {}
        http_status = status.HTTP_204_NO_CONTENT

        if user.has_perm('share_asset', target_asset) and \
            user.has_perm('view_asset', source_asset):
            if not target_asset.copy_permissions_from(source_asset):
                http_status = status.HTTP_400_BAD_REQUEST
                response = {"detail": "Source and destination objects don't seem to have the same type"}
        else:
            raise exceptions.PermissionDenied()

        return Response(response, status=http_status)

    def perform_create(self, serializer):
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        user = self.request.user
        if user.is_anonymous():
            user = get_anonymous_user()
        serializer.save(owner=user)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()

        if CLONE_ARG_NAME in request.data:
            serializer = self._get_clone_serializer(instance)
        else:
            serializer = self.get_serializer(instance, data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        if hasattr(instance, 'has_deployment') and instance.has_deployment:
            instance.deployment.delete()
        return super(AssetViewSet, self).perform_destroy(instance)

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


class SitewideMessageViewSet(viewsets.ModelViewSet):
    queryset = SitewideMessage.objects.all()
    serializer_class = SitewideMessageSerializer


class UserCollectionSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = UserCollectionSubscription.objects.none()
    serializer_class = UserCollectionSubscriptionSerializer
    lookup_field = 'uid'

    def get_queryset(self):
        user = self.request.user
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        if user.is_anonymous():
            user = get_anonymous_user()
        criteria = {'user': user}
        if 'collection__uid' in self.request.query_params:
            criteria['collection__uid'] = self.request.query_params[
                'collection__uid']
        return UserCollectionSubscription.objects.filter(**criteria)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TokenView(APIView):
    def _which_user(self, request):
        '''
        Determine the user from `request`, allowing superusers to specify
        another user by passing the `username` query parameter
        '''
        if request.user.is_anonymous():
            raise exceptions.NotAuthenticated()

        if 'username' in request.query_params:
            # Allow superusers to get others' tokens
            if request.user.is_superuser:
                user = get_object_or_404(
                    User,
                    username=request.query_params['username']
                )
            else:
                raise exceptions.PermissionDenied()
        else:
            user = request.user
        return user

    def get(self, request, *args, **kwargs):
        ''' Retrieve an existing token only '''
        user = self._which_user(request)
        token = get_object_or_404(Token, user=user)
        return Response({'token': token.key})

    def post(self, request, *args, **kwargs):
        ''' Return a token, creating a new one if none exists '''
        user = self._which_user(request)
        token, created = Token.objects.get_or_create(user=user)
        return Response(
            {'token': token.key},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    def delete(self, request, *args, **kwargs):
        ''' Delete an existing token and do not generate a new one '''
        user = self._which_user(request)
        with transaction.atomic():
            token = get_object_or_404(Token, user=user)
            token.delete()
        return Response({}, status=status.HTTP_204_NO_CONTENT)


class EnvironmentView(APIView):
    """
    GET-only view for certain server-provided configuration data
    """

    CONFIGS_TO_EXPOSE = [
        'TERMS_OF_SERVICE_URL',
        'PRIVACY_POLICY_URL',
        'SOURCE_CODE_URL',
        'SUPPORT_URL',
        'SUPPORT_EMAIL',
    ]

    def get(self, request, *args, **kwargs):
        """
        Return the lowercased key and value of each setting in
        `CONFIGS_TO_EXPOSE`, along with the static lists of sectors, countries,
        all known languages, and languages for which the interface has
        translations.
        """
        data = {
            key.lower(): getattr(constance.config, key)
                for key in self.CONFIGS_TO_EXPOSE
        }
        data['available_sectors'] = SECTORS
        data['available_countries'] = COUNTRIES
        data['all_languages'] = LANGUAGES
        data['interface_languages'] = settings.LANGUAGES
        return Response(data)
