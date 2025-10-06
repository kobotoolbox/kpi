# coding: utf-8
from django.http import HttpResponseRedirect
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from private_storage.views import PrivateStorageDetailView
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedNoUpdateModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.constants import PERM_VIEW_ASSET
from kpi.filters import RelatedAssetPermissionsFilter
from kpi.models import AssetFile
from kpi.permissions import AssetEditorPermission
from kpi.schema_extensions.v2.files.schema import (
    BASE64_METADATA_SCHEMA,
    URL_METADATA_SCHEMA,
)
from kpi.schema_extensions.v2.files.serializers import CreateFilePayload, FilesResponse
from kpi.schema_extensions.v2.generic.schema import ASSET_URL_SCHEMA, USER_URL_SCHEMA
from kpi.serializers.v2.asset_file import AssetFileSerializer
from kpi.utils.schema_extensions.examples import generate_example_from_schema
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Survey data'],
    parameters=[
        OpenApiParameter(
            name='parent_lookup_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'files/create.md'),
        request={'application/json': CreateFilePayload},
        responses=open_api_201_created_response(
            FilesResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        examples=[
            OpenApiExample(
                name='Creating a file with binary content',
                value={
                    'user': generate_example_from_schema(USER_URL_SCHEMA),
                    'asset': generate_example_from_schema(ASSET_URL_SCHEMA),
                    'description': 'Description of the file',
                    'file_type': 'image/png',
                    'content': '<binary>',
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Creating a file with Base64 content',
                value={
                    'user': generate_example_from_schema(USER_URL_SCHEMA),
                    'asset': generate_example_from_schema(ASSET_URL_SCHEMA),
                    'description': 'Description of the file',
                    'file_type': 'image/png',
                    'base64Encoded': 'SGVsbG8sIFdvcmxkIQ',
                    'metadata': generate_example_from_schema(BASE64_METADATA_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Creating a file with a remote url',
                value={
                    'user': generate_example_from_schema(USER_URL_SCHEMA),
                    'asset': generate_example_from_schema(ASSET_URL_SCHEMA),
                    'description': 'Description of the file',
                    'file_type': 'image/png',
                    'metadata': generate_example_from_schema(URL_METADATA_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    content=extend_schema(
        description=read_md('kpi', 'files/content.md'),
        responses=open_api_200_ok_response(
            description='Will return a content type with the type of the attachment as well as the attachment itself.',  # noqa
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'files/delete.md'),
        responses=open_api_204_empty_response(
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    list=extend_schema(
        description=read_md('kpi', 'files/list.md'),
        responses=open_api_200_ok_response(
            FilesResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    partial_update=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'files/retrieve.md'),
        responses=open_api_200_ok_response(
            FilesResponse,
            validate_payload=False,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    update=extend_schema(
        exclude=True,
    ),
)
class AssetFileViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedNoUpdateModelViewSet
):
    """
    ViewSet for managing the current user's assets

    Available actions:
    - list           → GET /api/v2/assets/{parent_lookup_asset}/files/
    - create         → POST /api/v2/assets/{parent_lookup_asset}/files/
    - retrieve       → GET /api/v2/assets/{parent_lookup_asset}/files/{uid}/
    - delete         → DELETE /api/v2/assets/{parent_lookup_asset}/files/{uid}/
    - content        → GET /api/v2/assets/{parent_lookup_asset}/files/{uid}/content/

    Documentation:
    - docs/api/v2/files/list.md
    - docs/api/v2/files/create.md
    - docs/api/v2/files/retrieve.md
    - docs/api/v2/files/delete.md
    - docs/api/v2/files/content.md
    """

    model = AssetFile
    lookup_field = 'uid'
    filter_backends = (RelatedAssetPermissionsFilter,)
    serializer_class = AssetFileSerializer
    permission_classes = (AssetEditorPermission,)
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [
        'uid',
        'filename',
        'md5_hash',
        'download_url',
        ('object_id', 'asset.id'),
        'asset.owner.username',
    ]

    def get_queryset(self):
        _queryset = self.model.objects.filter(asset__uid=self.asset_uid)
        file_type = self.request.GET.get('file_type')
        if file_type is not None:
            _queryset = _queryset.filter(file_type=file_type)
        _queryset = _queryset.filter(date_deleted__isnull=True).exclude(
            file_type=AssetFile.PAIRED_DATA
        )
        return _queryset

    def perform_create_override(self, serializer):
        serializer.save(
            asset=self.asset,
            user=self.request.user
        )

    class PrivateContentView(PrivateStorageDetailView):
        model = AssetFile
        model_file_field = 'content'

        # Help mitigate the risk from things like inline JavaScript inside SVGs
        # by forcing the browser to download the file instead of display it.
        # File content can still be embedded e.g. via an `<img>` tag, but that
        # is not a concern because browsers refuse to execute scripts inside
        # these embeds. From
        # https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element:
        #   The src attribute must be present, and must contain a valid
        #   non-empty URL potentially surrounded by spaces referencing a
        #   non-interactive, optionally animated, image resource that is neither
        #   paged nor scripted.
        #
        # Setting `ENABLE_CSP=True` will also thwart inline JS inside SVGs, so
        # long as `unsafe-inline` is not allowed by the policy.
        content_disposition = 'attachment'

        # ToDo Evaluate this check, may be redundant.
        # `AssetNestedObjectPermission` is already in charge to check
        # permissions
        def can_access_file(self, private_file):
            return private_file.request.user.has_perm(
                PERM_VIEW_ASSET, private_file.parent_object.asset
            )

    @action(detail=True, methods=['GET'])
    def content(self, *args, **kwargs):

        asset_file = self.get_object()

        if asset_file.metadata.get('redirect_url'):
            return HttpResponseRedirect(asset_file.metadata.get('redirect_url'))

        view = self.PrivateContentView.as_view(
            model=AssetFile,
            slug_url_kwarg='uid',
            slug_field='uid',
            model_file_field='content'
        )

        # TODO: simply redirect if external storage with expiring tokens (e.g.
        # Amazon S3) is used?
        #   return HttpResponseRedirect(asset_file.content.url)
        return view(self.request, uid=asset_file.uid)
