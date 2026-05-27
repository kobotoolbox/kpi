# coding: utf-8
from django.conf import settings
from django.http import Http404, HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.base_views import AuditLoggedModelViewSet
from kobo.apps.audit_log.models import AuditType
from kpi.models import Asset, AssetFile, PairedData
from kpi.permissions import AssetEditorPermission, XMLExternalDataPermission
from kpi.renderers import SubmissionXMLRenderer
from kpi.schema_extensions.v2.paired_data.serializers import (
    ExternalResponse,
    PairedDataPatchPayload,
    PairedDataResponse,
)
from kpi.serializers.v2.paired_data import PairedDataSerializer
from kpi.utils.paired_data import build_and_save_paired_data_xml
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
            name='uid_asset',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the parent asset',
        ),
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'paired_data/create.md'),
        responses=open_api_201_created_response(
            PairedDataResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'paired_data/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_paired_data',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the paired data',
            ),
        ],
    ),
    external=extend_schema(
        description=read_md('kpi', 'paired_data/external.md'),
        responses=open_api_200_ok_response(
            ExternalResponse,
            media_type='application/xml',
            error_media_type='application/xml',
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_paired_data',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the paired data',
            ),
        ],
    ),
    list=extend_schema(
        description=read_md('kpi', 'paired_data/list.md'),
        responses=open_api_200_ok_response(
            PairedDataResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    update=extend_schema(
        exclude=True,
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'paired_data/retrieve.md'),
        responses=open_api_200_ok_response(
            PairedDataResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_paired_data',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the paired data',
            ),
        ],
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'paired_data/update.md'),
        request={'application/json': PairedDataPatchPayload},
        responses=open_api_200_ok_response(
            PairedDataResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
        parameters=[
            OpenApiParameter(
                name='uid_paired_data',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='UID of the paired data',
            ),
        ],
    ),
)
class PairedDataViewset(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, AuditLoggedModelViewSet
):
    """
    Available actions:
     - create        → POST      /api/v2/asset/{uid_asset}/paired-data/
     - delete        → DELETE    /api/v2/asset/{uid_asset}/paired-data/{uid_paired_data}/
     - external      → GET       /api/v2/asset/{uid_asset}/paired-data/{uid_paired_data}/external/  # noqa
     - list          → GET       /api/v2/asset/{uid_asset}/paired-data/
     - retrieve      → GET       /api/v2/asset/{uid_asset}/paired-data/{uid_paired_data}/
     - update        → PATCH     /api/v2/asset/{uid_asset}/paired-data/{uid_paired_data}/


     Documentation:
     - docs/api/v2/paired_data/create.md
     - docs/api/v2/paired_data/delete.md
     - docs/api/v2/paired_data/external.md
     - docs/api/v2/paired_data/list.md
     - docs/api/v2/paired_data/retrieve.md
     - docs/api/v2/paired_data/update.md
    """

    parent_model = Asset
    lookup_field = 'paired_data_uid'
    lookup_url_kwarg = 'uid_paired_data'
    permission_classes = (AssetEditorPermission,)
    serializer_class = PairedDataSerializer
    log_type = AuditType.PROJECT_HISTORY
    logged_fields = [
        ('source_name', 'source.name'),
        ('object_id', 'asset.id'),
        'fields',
        ('source_uid', 'source.uid'),
        'asset.owner.username',
    ]

    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[XMLExternalDataPermission],
        renderer_classes=[SubmissionXMLRenderer],
        filter_backends=[],
    )
    def external(self, request, uid_paired_data, **kwargs):
        paired_data = self.get_object()

        # Retrieve the source if it exists
        source_asset = paired_data.get_source()

        if not source_asset:
            # We can enter this condition when source data sharing has been
            # deactivated after it has been paired with current form.
            # We don't want to keep zombie files on storage.
            try:
                asset_file = self.asset.asset_files.get(uid=uid_paired_data)
            except AssetFile.DoesNotExist:
                pass
            else:
                asset_file.delete()

            raise Http404

        if not source_asset.has_deployment or not self.asset.has_deployment:
            raise Http404

        old_hash = None
        # Retrieve data from related asset file.
        # If data has already been fetched once, an `AssetFile` should exist.
        # Otherwise, we create one to store the generated XML.
        refresh_async = False
        try:
            asset_file = self.asset.asset_files.get(uid=uid_paired_data)
        except AssetFile.DoesNotExist:
            asset_file = AssetFile(
                uid=uid_paired_data,
                asset=self.asset,
                file_type=AssetFile.PAIRED_DATA,
                user=self.asset.owner,
            )
            # When the asset file is new, we consider its content as expired to
            # force its creation below
            has_expired = True
        else:
            if not asset_file.content:
                # if `asset_file` exists but does not have any content, it means
                # `paired_data` has changed since last time this endpoint has been
                # called. E.g.: Project owner has changed the questions they want
                # to include in the `xml-external` file
                has_expired = True
            else:
                old_hash = asset_file.md5_hash
                timedelta = timezone.now() - asset_file.date_modified
                has_expired = (
                    timedelta.total_seconds() > settings.PAIRED_DATA_EXPIRATION
                )
                # File exists and is stale only due to time: regenerate in the
                # background so the manifest request is not blocked by fetching
                # and parsing a potentially large number of submissions.
                refresh_async = has_expired

        if not has_expired:
            return self._xml_response(
                request,
                asset_file.content.file.read().decode(),
                asset_file.md5_hash,
            )

        if refresh_async:
            from kpi.tasks import regenerate_paired_data

            content = asset_file.content.file.read().decode()
            regenerate_paired_data.delay(self.asset.uid, uid_paired_data)
            # Return the current (possibly stale) content immediately.
            # The manifest will reflect the new hash once the task completes.
            return self._xml_response(request, content, asset_file.md5_hash)

        # If the content of `asset_file' has expired, let's regenerate the XML
        xml_ = build_and_save_paired_data_xml(
            self.asset, asset_file, paired_data, source_asset, old_hash=old_hash
        )
        return self._xml_response(request, xml_, asset_file.md5_hash)

    def get_object_override(self):
        obj = self.get_queryset(as_list=False).get(
            self.kwargs[self.lookup_url_kwarg]
        )
        if not obj:
            raise Http404

        # May raise a permission denied
        self.check_object_permissions(self.request, obj)

        return obj

    def get_queryset(self, as_list=True):
        queryset = PairedData.objects(self.asset)
        if as_list:
            return list(queryset.values())
        return queryset

    def get_serializer_context(self):
        context_ = super().get_serializer_context()
        context_['asset'] = self.asset

        # To avoid multiple calls to DB within the serializer on the
        # list endpoint, we retrieve all source names and cache them in a dict.
        # The serializer can access it through the context.
        source_uids = self.asset.paired_data.keys()
        source__names = {}
        records = Asset.objects.values('uid', 'name').filter(uid__in=source_uids)
        for record in records:
            source__names[record['uid']] = record['name']
        context_['source__names'] = source__names
        return context_

    @staticmethod
    def _xml_response(request, xml_content: str, md5_hash: str = None) -> HttpResponse:
        """
        Build an HttpResponse for an XML body with optional ETag validation.

        Gzip compression is handled by nginx upstream, so it is not applied
        here.

        - If `md5_hash` is provided and the client's `If-None-Match` header
          matches, returns HTTP 304 Not Modified.
        - `ETag` and `Cache-Control` headers are added when `md5_hash`
          is available.
        """
        etag_value = md5_hash.split(':')[-1] if md5_hash else None

        if etag_value:
            # `If-None-Match` can contain multiple comma-separated ETags.
            # Handle weak validators (W/ prefix added by nginx when gzip is
            # applied) and the wildcard (*) per-token.
            raw_if_none_match = request.META.get('HTTP_IF_NONE_MATCH', '')
            if raw_if_none_match:
                for candidate in raw_if_none_match.split(','):
                    token = candidate.strip()
                    if not token:
                        continue
                    if token.startswith('W/'):
                        token = token[2:].lstrip()
                    if (
                        token.startswith('"')
                        and token.endswith('"')
                        and len(token) >= 2
                    ):
                        token = token[1:-1]
                    if token == '*' or token == etag_value:
                        return HttpResponse(status=304)

        xml_bytes = xml_content.encode()
        response = HttpResponse(xml_bytes, content_type='text/xml; charset=utf-8')
        response['Content-Length'] = len(xml_bytes)

        if etag_value:
            response['ETag'] = f'"{etag_value}"'
            response['Cache-Control'] = (
                f'private, max-age={settings.PAIRED_DATA_EXPIRATION}'
            )

        return response


class OpenRosaDynamicDataAttachmentViewset(PairedDataViewset):
    """
    Only specific to OpenRosa manifest when projects are linked with DDA.
    Enforce permission and renderer classes at the class level instead to be
    sure they are taken into account while calling `viewset.as_view()`
    """

    permission_classes = [XMLExternalDataPermission]
    renderer_classes = [SubmissionXMLRenderer]
    filter_backends = []
