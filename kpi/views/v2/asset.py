import copy
import json
from collections import OrderedDict, defaultdict
from operator import itemgetter

from django.db.models import Count
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import exceptions, renderers, status
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.audit_log.models import AuditType
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kpi.constants import (
    ASSET_TYPE_ARG_NAME,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    ASSET_TYPES,
    CLONE_ARG_NAME,
    CLONE_COMPATIBLE_TYPES,
    CLONE_FROM_VERSION_ID_ARG_NAME,
)
from kpi.exceptions import BadAssetTypeException
from kpi.filters import (
    AssetOrderingFilter,
    ExcludeOrgAssetFilter,
    KpiObjectPermissionsFilter,
    SearchFilter,
)
from kpi.highlighters import highlight_xform
from kpi.mixins.asset import AssetViewSetListMixin
from kpi.mixins.object_permission import ObjectPermissionViewSetMixin
from kpi.models import Asset, UserAssetSubscription
from kpi.paginators import AssetPagination
from kpi.permissions import (
    AssetPermission,
    PostMappedToChangePermission,
    ReportPermission,
    get_perm_name,
)
from kpi.renderers import BasicHTMLRenderer, SSJsonRenderer, XFormRenderer, XlsRenderer
from kpi.schema_extensions.v2.assets.schema import (
    ASSET_CLONE_FROM_SCHEMA,
    ASSET_CONTENT_SCHEMA,
    ASSET_ENABLED_SCHEMA,
    ASSET_FIELDS_SCHEMA,
    ASSET_NAME_SCHEMA,
    ASSET_SETTINGS_SCHEMA,
    ASSET_TYPE_SCHEMA,
    BULK_ACTION_SCHEMA,
    BULK_ASSET_UIDS_SCHEMA,
    BULK_CONFIRM_SCHEMA,
)
from kpi.schema_extensions.v2.assets.serializers import (
    AssetBulkRequest,
    AssetBulkResponse,
    AssetContentResponse,
    AssetCreateRequest,
    AssetHashResponse,
    AssetMetadataResponse,
    AssetPatchRequest,
    AssetReportResponse,
    AssetValidContentResponse,
)
from kpi.schema_extensions.v2.deployments.serializers import (
    DeploymentCreateRequest,
    DeploymentPatchRequest,
    DeploymentResponse,
)
from kpi.serializers.v2.asset import (
    AssetBulkActionsSerializer,
    AssetListSerializer,
    AssetSerializer,
)
from kpi.serializers.v2.deployment import DeploymentSerializer
from kpi.serializers.v2.reports import ReportsDetailSerializer
from kpi.utils.bugfix import repair_file_column_content_and_save
from kpi.utils.hash import calculate_hash
from kpi.utils.kobo_to_xlsform import to_xlsform_structure
from kpi.utils.object_permission import get_database_user, get_objects_for_user
from kpi.utils.schema_extensions.examples import generate_example_from_schema
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
    open_api_http_example_response,
)
from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable


@extend_schema(
    tags=['Manage projects and library content'],
)
@extend_schema_view(
    bulk=extend_schema(
        description=read_md('kpi', 'assets/bulk.md'),
        request={'application/json': AssetBulkRequest},
        responses=open_api_200_ok_response(
            AssetBulkResponse(),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        examples=[
            OpenApiExample(
                name='Perform action on one or more asset',
                value={
                    'asset_uids': generate_example_from_schema(BULK_ASSET_UIDS_SCHEMA),
                    'action': generate_example_from_schema(BULK_ACTION_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Perform bulk on ALL asset',
                value={
                    'confirm': generate_example_from_schema(BULK_CONFIRM_SCHEMA),
                    'action': generate_example_from_schema(BULK_ACTION_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    content=extend_schema(
        description=read_md('kpi', 'assets/content.md'),
        request={},
        responses=open_api_200_ok_response(
            AssetContentResponse(),
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    create=extend_schema(
        description=read_md('kpi', 'assets/create.md'),
        request={'application/json': AssetCreateRequest},
        responses=open_api_201_created_response(
            AssetSerializer(),
            raise_not_found=False,
            raise_access_forbidden=False,
        ),
        examples=[
            OpenApiExample(
                name='Creating an asset',
                value={
                    'name': generate_example_from_schema(ASSET_NAME_SCHEMA),
                    'settings': generate_example_from_schema(ASSET_SETTINGS_SCHEMA),
                    'asset_type': generate_example_from_schema(ASSET_TYPE_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Cloning an asset',
                value={
                    'name': generate_example_from_schema(ASSET_NAME_SCHEMA),
                    'clone_from': generate_example_from_schema(ASSET_CLONE_FROM_SCHEMA),
                    'asset_type': generate_example_from_schema(ASSET_TYPE_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'assets/delete.md'),
        responses=open_api_204_empty_response(
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    deployment=extend_schema(tags=['Manage projects and library content']),
    hash=extend_schema(
        description=read_md('kpi', 'assets/hash.md'),
        responses=open_api_200_ok_response(
            AssetHashResponse,
            raise_access_forbidden=False,
            raise_not_found=False,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('kpi', 'assets/list.md'),
        responses=open_api_200_ok_response(
            AssetSerializer,
            require_auth=False,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    metadata=extend_schema(
        description=read_md('kpi', 'assets/metadata.md'),
        responses=open_api_200_ok_response(
            AssetMetadataResponse(),
            require_auth=False,
            raise_not_found=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'assets/patch.md'),
        request={'application/json': AssetPatchRequest},
        responses=open_api_200_ok_response(
            AssetSerializer(),
            raise_access_forbidden=False,
        ),
        examples=[
            OpenApiExample(
                name='Updating an asset',
                value={
                    'content': generate_example_from_schema(ASSET_CONTENT_SCHEMA),
                    'name': generate_example_from_schema(ASSET_NAME_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Data sharing of the project',
                value={
                    'enabled': generate_example_from_schema(ASSET_ENABLED_SCHEMA),
                    'fields': generate_example_from_schema(ASSET_FIELDS_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    update=extend_schema(exclude=True),
    reports=extend_schema(
        description=read_md('kpi', 'assets/reports.md'),
        request={},
        responses=open_api_200_ok_response(
            AssetReportResponse(),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        tags=['Survey data'],
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'assets/retrieve.md'),
        responses=open_api_200_ok_response(
            AssetSerializer(),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    table_view=extend_schema(
        description=read_md('kpi', 'assets/table_view.md'),
        responses=open_api_http_example_response(
            name='Table View Example',
            summary='Expected HTML response',
            value=read_md('kpi', 'assets/http_examples/table_example.md'),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    valid_content=extend_schema(
        description=read_md('kpi', 'assets/valid_content.md'),
        responses=open_api_200_ok_response(
            AssetValidContentResponse(),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    xform=extend_schema(
        description=read_md('kpi', 'assets/xform.md'),
        responses=open_api_http_example_response(
            name='XFORM Example',
            summary='Expected HTML response',
            value=read_md('kpi', 'assets/http_examples/xform_example.md'),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    xls=extend_schema(
        description=read_md('kpi', 'assets/xls.md'),
        responses=open_api_http_example_response(
            name='XLS Example',
            summary='Expected HTML response',
            value=read_md('kpi', 'assets/http_examples/table_example.md'),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class AssetViewSet(
    AssetViewSetListMixin,
    ObjectPermissionViewSetMixin,
    NestedViewSetMixin,
    AuditLoggedModelViewSet,
):
    """
    ViewSet for managing the current user's assets

    Available actions:
    - list           → GET /api/v2/assets/
    - create         → POST /api/v2/assets/
    - retrieve       → GET /api/v2/assets/{uid_asset}/
    - patch          → PATCH /api/v2/assets/{uid_asset}/
    - delete         → DELETE /api/v2/assets/{uid_asset}/
    - content        → GET /api/v2/assets/{uid_asset}/content/
    - reports        → GET /api/v2/assets/{uid_asset}/reports/
    - table_view     → GET /api/v2/assets/{uid_asset}/table_view/
    - valid_content  → GET /api/v2/assets/{uid_asset}/valid_content/
    - xform          → GET /api/v2/assets/{uid_asset}/xform/
    - xls            → GET /api/v2/assets/{uid_asset}/xls/
    - bulk           → POST /api/v2/assets/bulk/
    - hash           → GET /api/v2/assets/hash/
    - metadata       → GET /api/v2/assets/metadata/

    Documentation:
    - docs/api/v2/assets/list.md
    - docs/api/v2/assets/create.md
    - docs/api/v2/assets/retrieve.md
    - docs/api/v2/assets/patch.md
    - docs/api/v2/assets/delete.md
    - docs/api/v2/assets/content.md
    - docs/api/v2/assets/reports.md
    - docs/api/v2/assets/table_view.md
    - docs/api/v2/assets/valid_content.md
    - docs/api/v2/assets/xform.md
    - docs/api/v2/assets/xls.md
    - docs/api/v2/assets/bulk.md
    - docs/api/v2/assets/hash.md
    - docs/api/v2/assets/metadata.md
    """

    # Filtering handled by KpiObjectPermissionsFilter.filter_queryset()
    queryset = Asset.objects.all()
    lookup_field = 'uid'
    lookup_url_kwarg = 'uid_asset'
    pagination_class = AssetPagination
    permission_classes = (AssetPermission,)
    ordering_fields = AssetOrderingFilter.DEFAULT_ORDERING_FIELDS + [
        'subscribers_count',
    ]
    filter_backends = [
        ExcludeOrgAssetFilter,
        KpiObjectPermissionsFilter,
        SearchFilter,
        AssetOrderingFilter,
    ]
    # Terms that can be used to search and filter return values
    # from a query `q`
    search_default_field_lookups = [
        'name__icontains',
        'owner__username__icontains',
        'settings__description__icontains',
        'summary__icontains',
        'tags__name__icontains',
        'uid__icontains',
    ]

    logged_fields = [
        'has_deployment',
        'id',
        'name',
        'settings',
        'latest_version.uid',
        'data_sharing',
        'content',
        'advanced_features._actionConfigs',
        'owner.username',
    ]
    log_type = AuditType.PROJECT_HISTORY

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._serializer_context = {}

    @action(
        detail=False,
        methods=['POST'],
    )
    def bulk(self, request, *args, **kwargs):
        return Response(self._bulk_asset_actions(request.data))

    @extend_schema(tags=['Form content'])
    @action(detail=True)
    def content(self, request, uid_asset):
        asset = self.get_object()
        return Response(
            {
                'kind': 'asset.content',
                'uid_asset': asset.uid,
                'data': asset.to_ss_structure(),
            }
        )

    def create(self, request, *args, **kwargs):
        if CLONE_ARG_NAME in request.data:
            serializer = self._get_clone_serializer()
        else:
            serializer = self.get_serializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    @extend_schema(
        methods=['GET'],
        description=read_md('kpi', 'deployments/list.md'),
        responses=open_api_200_ok_response(
            DeploymentResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    )
    @extend_schema(
        methods=['PATCH'],
        description=read_md('kpi', 'deployments/update.md'),
        request={'application/json': DeploymentPatchRequest},
        responses=open_api_200_ok_response(
            DeploymentResponse,
            raise_access_forbidden=False,
        ),
    )
    @extend_schema(
        methods=['POST'],
        description=read_md('kpi', 'deployments/create.md'),
        request={'application/json': DeploymentCreateRequest},
        responses=open_api_200_ok_response(
            DeploymentResponse,
            raise_access_forbidden=False,
        ),
    )
    @action(detail=True,
            methods=['get', 'post', 'patch'],
            permission_classes=[PostMappedToChangePermission])
    def deployment(self, request, uid_asset):
        """
        ViewSet for managing the current project's deployment

        Available actions:
        - list           → GET /api/v2/assets/{uid_asset}/deployment/
        - create         → POST /api/v2/assets/{uid_asset}/deployment/
        - patch          → PATCH /api/v2/assets/{uid_asset}/deployment/

        Documentation:
        - docs/api/v2/deployments/list.md
        - docs/api/v2/deployments/create.md
        - docs/api/v2/deployments/patch.md
        """
        asset = self.get_object()
        serializer_context = self.get_serializer_context()
        serializer_context['asset'] = asset

        if 'identifier' not in request.data and 'id_string' in request.data:
            raise NotImplementedError

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
                raise BadAssetTypeException(
                    'Only surveys may be deployed, but this asset is a '
                    f'{asset.asset_type}'
                )
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
                request._request.additional_audit_log_info = {
                    'id': asset.id,
                    'latest_deployed_version_uid': asset.latest_deployed_version_uid,
                    'latest_version_uid': asset.latest_version.uid,
                    'owner_username': asset.owner.username,
                }
                # TODO: Understand why this 404s when `serializer.data` is not
                # coerced to a dict
                return Response(dict(serializer.data))

        elif request.method == 'PATCH':
            if not asset.can_be_deployed:
                raise BadAssetTypeException(
                    'Only surveys may be deployed, '
                    f'but this asset is a {asset.asset_type}'
                )
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
                only_active_changed = set(serializer.validated_data.keys()) == {
                    'active'
                }
                request._request.additional_audit_log_info = {
                    'only_active_changed': only_active_changed,
                    'active': serializer.data['active'],
                    'latest_deployed_version_uid': asset.latest_deployed_version_uid,
                    'latest_version_uid': asset.latest_version.uid,
                    'owner_username': asset.owner.username,
                }
                # TODO: Understand why this 404s when `serializer.data` is not
                # coerced to a dict
                return Response(dict(serializer.data))

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

    def get_object_override(self):
        """
        This `get_object` method bypasses the filter backends because the UID
        already explicitly filters the object to be retrieved.
        It relies on `check_object_permissions` to validate access to the object.
        """
        try:
            asset = Asset.objects.get(uid=self.kwargs[self.lookup_url_kwarg])
        except Asset.DoesNotExist:
            raise Http404

        self.check_object_permissions(self.request, asset)

        # Cope with kobotoolbox/formpack#322, which wrote invalid content
        # into the database. For performance, consider only the current
        # content, not previous versions. Previous versions are handled in
        # `kobo.apps.reports.report_data.build_formpack()`
        if self.request.method == 'GET':
            repair_file_column_content_and_save(asset, include_versions=False)

        return asset

    def get_queryset(self, *args, **kwargs):

        if self.detail:
            # For detail views, we must explicitly bypass the NestedViewSetMixin.
            return super(NestedViewSetMixin, self).get_queryset(*args, **kwargs)

        queryset = super().get_queryset(*args, **kwargs)
        if self.action == 'list':
            return queryset.model.optimize_queryset_for_list(queryset)
        else:
            # This is called to retrieve an individual record. How much do we
            # have to care about optimizations for that?
            return queryset

    def get_metadata(self, queryset):
        """
        Prepare metadata to inject in list endpoint.
        Useful to retrieve values needed for search

        :return: dict
        """
        metadata = {
            'languages': set(),
            'countries': OrderedDict(),
            'sectors': OrderedDict(),
            'organizations': set(),
        }

        records = queryset.values('summary', 'settings').exclude(
            summary__languages=[],
            settings__country_codes=[],
            settings__sector={},
            settings__organization='',
        )

        # Languages
        records = records.order_by()

        for record in records.all():
            try:
                languages = record['summary']['languages']
            except (ValueError, KeyError):
                pass
            else:
                for language in languages:
                    if language:
                        metadata['languages'].add(language)

            try:
                country = record['settings']['country']
                value = country['value']
                label = country['label']
            except (KeyError, TypeError):
                pass
            else:
                if value and value not in metadata['countries']:
                    metadata['countries'][value] = label

            try:
                sector = record['settings']['sector']
                value = sector['value']
                label = sector['label']
            except (KeyError, TypeError):
                pass
            else:
                if value and value not in metadata['sectors']:
                    metadata['sectors'][value] = label

            try:
                organization = record['settings']['organization']
            except KeyError:
                pass
            else:
                if organization:
                    metadata['organizations'].add(organization)

        metadata['languages'] = sorted(list(metadata['languages']))

        metadata['countries'] = sorted(metadata['countries'].items(),
                                       key=itemgetter(1))

        metadata['sectors'] = sorted(metadata['sectors'].items(),
                                     key=itemgetter(1))

        metadata['organizations'] = sorted(list(metadata['organizations']))

        return metadata

    def get_paginated_response(self, data, metadata=None):
        """
        Override parent `get_paginated_response` response to include `metadata`
        """
        assert self.paginator is not None
        return self.paginator.get_paginated_response(data, metadata)

    def get_renderers(self):
        if self.action == 'retrieve':
            return [
                JSONRenderer(),
                BasicHTMLRenderer(),
                SSJsonRenderer(),
                XFormRenderer(),
                XlsRenderer(),
            ]
        return super().get_renderers()

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        else:
            return AssetSerializer

    def get_serializer_context(self):
        """
        Extra context provided to the serializer class.
        """
        context_ = super().get_serializer_context()
        context_.update(self._serializer_context)

        if self.action == 'list':
            # To avoid making a triple join-query for each asset in the list
            # to retrieve related objects, we populated dicts key-ed by asset
            # ids with the data needed by serializer.
            # We create one (big) query per dict instead of a separate query
            # for each asset in the list.
            # The serializer will be able to pick what it needs from that dict
            # and narrow down data according to users' permissions.

            # self._filtered_queryset is set in the `list()` method that
            # DRF automatically calls and is overridden below. This is
            # to prevent double calls to `filter_queryset()` as described in
            # the issue here: https://github.com/kobotoolbox/kpi/issues/2576
            queryset = self._filtered_queryset

            # 1) Retrieve all asset IDs of the current list
            if 'asset_ids_cache' not in context_:
                asset_ids = AssetPagination.get_all_asset_ids_from_queryset(queryset)
                context_['asset_ids_cache'] = asset_ids
            else:
                asset_ids = context_['asset_ids_cache']

            # 2) Get object permissions per asset
            context_[
                'object_permissions_per_asset'
            ] = self.cache_all_assets_perms(asset_ids)

            # 3) Get the collection subscriptions per asset
            subscriptions_queryset = (
                UserAssetSubscription.objects.values('asset_id', 'user_id')
                .distinct()
                .filter(asset_id__in=asset_ids)
                .order_by('asset_id')
            )

            user_subscriptions_per_asset = defaultdict(list)
            for record in subscriptions_queryset:
                user_subscriptions_per_asset[record['asset_id']].append(
                    record['user_id']
                )

            context_['user_subscriptions_per_asset'] = user_subscriptions_per_asset

            # 4) Get children count per asset
            # Ordering must be cleared otherwise group_by is wrong
            # (i.e. default ordered field `date_modified` must be removed)
            records = (
                Asset.objects.filter(parent_id__in=asset_ids)
                .values('parent_id')
                .annotate(children_count=Count('id'))
                .order_by()
            )

            children_count_per_asset = {
                r.get('parent_id'): r.get('children_count', 0)
                for r in records if r.get('parent_id') is not None
            }

            context_['children_count_per_asset'] = children_count_per_asset

            # 5) Get organization…
            if organization := getattr(self.request, 'organization', None):
                # …from request.
                # e.g.: /api/v2/organizations/<uid_organization>/assets/`
                context_['organization'] = organization
            else:
                # …per asset
                # e.g.: /api/v2/organizations/assets/`
                context_['organizations_per_asset'] = (
                    self.get_organizations_per_asset_ids(asset_ids)
                )

        return context_

    def list(self, request, *args, **kwargs):
        # assigning global filtered query set to prevent additional,
        # unnecessary calls to `filter_queryset`
        self._filtered_queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(self._filtered_queryset)

        if page is not None:
            self._serializer_context['asset_ids_cache'] = []
            self._serializer_context['asset_uids_cache'] = []
            for asset in page:
                self._serializer_context['asset_ids_cache'].append(asset.pk)
                self._serializer_context['asset_uids_cache'].append(asset.uid)

            serializer = self.get_serializer(
                self._attach_xforms_to_assets(page), many=True
            )
            metadata = None
            if request.GET.get('metadata') == 'on':
                metadata = self.get_metadata(self._filtered_queryset)
            return self.get_paginated_response(serializer.data, metadata)

        serializer = self.get_serializer(self._filtered_queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'])
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
            accessible_assets = (
                get_objects_for_user(user, 'view_asset', Asset)
                .filter(asset_type=ASSET_TYPE_SURVEY)
                .order_by('uid')
            )

            assets_version_ids = [
                asset.version_id
                for asset in accessible_assets
                if asset.version_id is not None
            ]
            # Sort alphabetically
            assets_version_ids.sort()

            if len(assets_version_ids) > 0:
                hash_ = calculate_hash(''.join(assets_version_ids), algorithm='md5')
            else:
                hash_ = ''

            return Response({
                'hash': hash_
            })

    @action(detail=False, methods=['GET'])
    def metadata(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        metadata = self.get_metadata(queryset)
        return Response(metadata)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()

        if CLONE_ARG_NAME in request.data:
            serializer = self._get_clone_serializer(instance)
        else:
            serializer = self.get_serializer(instance,
                                             data=request.data,
                                             partial=True)

        serializer.is_valid(raise_exception=True)
        super().perform_update(serializer)
        return Response(serializer.data)

    def perform_create_override(self, serializer):
        user = get_database_user(self.request.user)
        serializer.save(
            owner=user,
            created_by=user.username,
            last_modified_by=user.username
        )

    def perform_destroy_override(self, instance):
        self._bulk_asset_actions(
            {'payload': {'asset_uids': [instance.uid], 'action': 'delete'}}
        )

    @action(
        detail=True,
        permission_classes=[ReportPermission],
        methods=['GET'],
    )
    def reports(self, request, *args, **kwargs):
        asset = self.get_object()
        if not asset.has_deployment:
            raise Http404
        serializer = ReportsDetailSerializer(
            asset, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @extend_schema(tags=['Form content'])
    @action(detail=True)
    def valid_content(self, request, uid_asset):
        asset = self.get_object()
        return Response(
            {
                'kind': 'asset.valid_content',
                'uid_asset': asset.uid,
                'data': to_xlsform_structure(asset.content),
            }
        )

    @extend_schema(tags=['Form content'])
    @action(detail=True, renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        md_table = ss_structure_to_mdtable(sa.ordered_xlsform_content())
        return Response('<!doctype html>\n'
                        '<html><body><code><pre>' + md_table.strip())

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        asset = self.get_object()
        export = asset.snapshot(regenerate=True)
        # TODO-- forward to AssetSnapshotViewset.xform
        response_data = copy.copy(export.details)
        options = {
            'linenos': True,
            'full': True,
        }
        if export.xml != '':
            response_data['highlighted_xform'] = highlight_xform(export.xml, **options)
        return Response(response_data, template_name='highlighted_xform.html')

    @extend_schema(tags=['Form content'])
    @action(detail=True, renderer_classes=[renderers.StaticHTMLRenderer])
    def xls(self, request, *args, **kwargs):
        return self.table_view(self, request, *args, **kwargs)

    def _attach_xforms_to_assets(self, assets: list):
        """
        Attach the related XForm to each Asset and yield them to
        stay memory-efficient.
        """

        asset_uids = self._serializer_context['asset_uids_cache']
        xform_qs = (
            XForm.all_objects.filter(kpi_asset_uid__in=asset_uids)
            .only(
                'id_string',
                'num_of_submissions',
                'attachment_storage_bytes',
                'require_auth',
                'uuid',
                'mongo_uuid',
                'encrypted',
                'last_submission_time',
                'kpi_asset_uid',
            )
            .order_by()
        )

        xforms_by_uid = {xf.kpi_asset_uid: xf for xf in xform_qs}

        # Single pass over assets: attach _xform then yield
        for asset in assets:
            if asset.has_deployment:
                xf = xforms_by_uid.get(asset.uid, None)
                xf.user = asset.owner
                asset.deployment._xform = xf
            yield asset

    def _bulk_asset_actions(self, data: dict) -> dict:
        params = {
            'data': data,
            'context': self.get_serializer_context(),
        }

        bulk_actions_validator = AssetBulkActionsSerializer(**params)
        bulk_actions_validator.is_valid(raise_exception=True)
        bulk_actions_validator.save()

        return bulk_actions_validator.data

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
                cloned_data.pop('asset_type', None)
            else:
                # Change asset_type if needed.
                cloned_data['asset_type'] = self.request.data.get(
                    ASSET_TYPE_ARG_NAME, original_asset.asset_type
                )

            cloned_asset_type = cloned_data.get('asset_type')
            # Settings are: Country, Description, Sector and Share-metadata
            # Copy settings only when original_asset is `survey` or `template`
            # and `asset_type` property of `cloned_data` is `survey` or `template`
            # or None (partial_update)
            if cloned_asset_type in [None, ASSET_TYPE_TEMPLATE, ASSET_TYPE_SURVEY] and \
                    original_asset.asset_type in [ASSET_TYPE_TEMPLATE, ASSET_TYPE_SURVEY]:

                settings = original_asset.settings.copy()
                settings.pop('share-metadata', None)

                cloned_data_settings = cloned_data.get('settings', {})

                # Depending of the client payload. settings can be JSON or string.
                # if it's a string. Let's load it to be able to merge it.
                if not isinstance(cloned_data_settings, dict):
                    cloned_data_settings = json.loads(cloned_data_settings)

                settings.update(cloned_data_settings)
                cloned_data['settings'] = json.dumps(settings)

            # until we get content passed as a dict, transform the content obj to a str
            # TODO, verify whether `Asset.content.settings.id_string` should be cleared out.
            cloned_data['content'] = json.dumps(cloned_data.get('content'))
            return cloned_data
        else:
            raise BadAssetTypeException(
                'Destination type is not compatible with source type'
            )

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
