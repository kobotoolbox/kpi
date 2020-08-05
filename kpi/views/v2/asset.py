# coding: utf-8
import copy
import json
from collections import defaultdict
from hashlib import md5


from django.contrib.contenttypes.models import ContentType
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import exceptions, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import (
    ASSET_TYPES,
    ASSET_TYPE_ARG_NAME,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    CLONE_ARG_NAME,
    CLONE_COMPATIBLE_TYPES,
    CLONE_FROM_VERSION_ID_ARG_NAME,
)
from kpi.deployment_backends.backends import DEPLOYMENT_BACKENDS
from kpi.exceptions import BadAssetTypeException
from kpi.filters import KpiObjectPermissionsFilter, SearchFilter
from kpi.highlighters import highlight_xform
from kpi.models import Asset
from kpi.models.object_permission import (
    ObjectPermission,
    get_anonymous_user,
    get_objects_for_user
)
from kpi.permissions import IsOwnerOrReadOnly, PostMappedToChangePermission, \
    get_perm_name
from kpi.renderers import AssetJsonRenderer, SSJsonRenderer, XFormRenderer, \
    XlsRenderer
from kpi.serializers import DeploymentSerializer
from kpi.serializers.v2.asset import AssetListSerializer, AssetSerializer
from kpi.utils.strings import hashable_str
from kpi.utils.kobo_to_xlsform import to_xlsform_structure
from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable


class AssetViewSet(NestedViewSetMixin, viewsets.ModelViewSet):
    """
    * Assign a asset to a collection <span class='label label-warning'>partially implemented</span>
    * Run a partial update of a asset <span class='label label-danger'>TODO</span>

    <span class='label label-danger'>TODO</span> Complete documentation

    ## List of asset endpoints

    Lists the asset endpoints accessible to requesting user, for anonymous access
    a list of public data endpoints is returned.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/

    Get a hash of all `version_id`s of assets.
    Useful to detect any changes in assets with only one call to `API`

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/hash/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/hash/

    ## CRUD

    * `uid` - is the unique identifier of a specific asset

    Retrieves current asset
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/
    </pre>


    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/

    Creates or clones an asset.
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/


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

    ### Data

    Retrieves data
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{uid}/data/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/

    ### Deployment

    Retrieves the existing deployment, if any.
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/{uid}/deployment/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/

    Creates a new deployment, but only if a deployment does not exist already.
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/{uid}/deployment/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/

    Updates the `active` field of the existing deployment.
    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/{uid}/deployment/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/

    Overwrites the entire deployment, including the form contents, but does not change the deployment's identifier
    <pre class="prettyprint">
    <b>PUT</b> /api/v2/assets/{uid}/deployment/
    </pre>

    > Example
    >
    >       curl -X PUT https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/deployment/


    ### CURRENT ENDPOINT
    """

    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Asset.objects.all()

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
        queryset = super().get_queryset(*args, **kwargs)
        if self.action == 'list':
            return queryset.model.optimize_queryset_for_list(queryset)
        else:
            # This is called to retrieve an individual record. How much do we
            # have to care about optimizations for that?
            return queryset

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        """

        context_ = super().get_serializer_context()
        if self.action == 'list':
            # To avoid making a triple join-query for each asset in the list
            # to retrieve object permissions, we make a big one at beginning
            # to build an dict key-ed by asset ids.
            # The serializer will be able to pick what it needs from that dict
            # and narrow down data according to users' permissions.
            queryset = super().get_queryset()
            asset_content_type = ContentType.objects.get_for_model(Asset)
            asset_ids = self.filter_queryset(queryset).values_list('id').distinct()
            object_permissions = ObjectPermission.objects.filter(
                content_type_id=asset_content_type.pk,
                object_id__in=asset_ids,
                deny=False,
            ).select_related(
                'user', 'permission'
            ).order_by(
                'user__username', 'permission__codename'
            )
            object_permissions_per_object = defaultdict(list)

            for op in object_permissions:
                object_permissions_per_object[op.object_id].append(op)

            context_['object_permissions_per_object'] = object_permissions_per_object

        return context_

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

    @action(detail=False, methods=["GET"],
            renderer_classes=[renderers.JSONRenderer])
    def hash(self, request):
        """
        Creates an hash of `version_id` of all accessible assets by the user.
        Useful to detect changes between each request.

        :param request:
        :return: JSON
        """
        user = self.request.user
        if user.is_anonymous:
            raise exceptions.NotAuthenticated()
        else:
            accessible_assets = get_objects_for_user(
                user, "view_asset", Asset).filter(asset_type=ASSET_TYPE_SURVEY) \
                .order_by("uid")

            assets_version_ids = [asset.version_id for asset in accessible_assets if asset.version_id is not None]
            # Sort alphabetically
            assets_version_ids.sort()

            if len(assets_version_ids) > 0:
                hash = md5(hashable_str("".join(assets_version_ids))).hexdigest()
            else:
                hash = ""

            return Response({
                "hash": hash
            })

    @action(detail=True, renderer_classes=[renderers.JSONRenderer])
    def content(self, request, uid):
        asset = self.get_object()
        return Response({
            'kind': 'asset.content',
            'uid': asset.uid,
            'data': asset.to_ss_structure(),
        })

    @action(detail=True, renderer_classes=[renderers.JSONRenderer])
    def valid_content(self, request, uid):
        asset = self.get_object()
        return Response({
            'kind': 'asset.valid_content',
            'uid': asset.uid,
            'data': to_xlsform_structure(asset.content),
        })

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def koboform(self, request, *args, **kwargs):
        asset = self.get_object()
        return Response({'asset': asset, }, template_name='koboform.html')

    @action(detail=True, renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.ordered_xlsform_content())
        return Response('<!doctype html>\n'
                        '<html><body><code><pre>' + md_table.strip())

    @action(detail=True, renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
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

    @action(detail=True, 
        methods=['get', 'post', 'patch'],
        permission_classes=[PostMappedToChangePermission]
    )
    def deployment(self, request, uid):
        """
        A GET request retrieves the existing deployment, if any.
        A POST request creates a new deployment, but only if a deployment does
            not exist already.
        A PATCH request updates the `active` field of the existing deployment.
        A PUT request overwrites the entire deployment, including the form
            contents, but does not change the deployment's identifier
        """
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

    def perform_create(self, serializer):
        # Check if the user is anonymous. The
        # django.contrib.auth.models.AnonymousUser object doesn't work for
        # queries.
        user = self.request.user
        if user.is_anonymous:
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
        return super().perform_destroy(instance)

    def finalize_response(self, request, response, *args, **kwargs):
        """ Manipulate the headers as appropriate for the requested format.
        See https://github.com/tomchristie/django-rest-framework/issues/1041#issuecomment-22709658.
        """
        # If the request fails at an early stage, e.g. the user has no
        # model-level permissions, accepted_renderer won't be present.
        if hasattr(request, 'accepted_renderer'):
            # Check the class of the renderer instead of just looking at the
            # format, because we don't want to set
            # `Content-Disposition: attachment` on asset snapshot XML
            if isinstance(request.accepted_renderer, XFormRenderer):
                filename = '.'.join(
                    (self.get_object().uid, request.accepted_renderer.format)
                )
                response[
                    'Content-Disposition'
                ] = 'attachment; filename={}'.format(filename)
            if isinstance(request.accepted_renderer, XlsRenderer):
                # `accepted_renderer.format` is 'xls' here for historical
                # reasons, but what we actually serve now is xlsx (Excel 2007+)
                filename = '.'.join((self.get_object().uid, 'xlsx'))
                response[
                    'Content-Disposition'
                ] = 'attachment; filename={}'.format(filename)

        return super().finalize_response(
            request, response, *args, **kwargs)
