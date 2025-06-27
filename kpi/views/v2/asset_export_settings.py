# coding: utf-8
import re

from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import renderers, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetExportSettings, SubmissionSynchronousExport
from kpi.permissions import AssetExportSettingsPermission
from kpi.renderers import SubmissionCSVRenderer, SubmissionXLSXRenderer
from kpi.schema_extensions.v2.export_settings.serializers import (
    ExportSettingResponse,
    ExportSettingCreatePayload,
    ExportSettingUpdatePayload
)
from kpi.serializers.v2.asset_export_settings import AssetExportSettingsSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response, \
    open_api_204_empty_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


@extend_schema(
    tags=['Export Settings'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'export_settings/create.md'),
        request={'application/json': ExportSettingCreatePayload},
        responses=open_api_200_ok_response(
            ExportSettingResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    data=extend_schema(
        description=read_md('kpi', 'export_settings/data.md'),
        responses=open_api_200_ok_response(
            None,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'export_settings/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    list=extend_schema(
        description=read_md('kpi', 'export_settings/list.md'),
        responses=open_api_200_ok_response(
            ExportSettingResponse(),
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'export_settings/retrieve.md'),
        responses=open_api_200_ok_response(
            ExportSettingResponse(),
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'export_settings/update.md'),
        request={'application/json': ExportSettingUpdatePayload},
        responses=open_api_200_ok_response(
            ExportSettingResponse,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    update=extend_schema(
        exclude=True
    )
)
class AssetExportSettingsViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing the current user's assets

    Available actions:
    - list           → GET /api/v2/export_settings/
    - create         → POST /api/v2/export_settings/
    - retrieve       → GET /api/v2/export_settings/{uid}/
    - patch          → PATCH /api/v2/export_settings/{uid}/
    - delete         → DELETE /api/v2/export_settings/{uid}/
    - data        → GET /api/v2/export_settings/{uid}/data/

    Documentation:
    - docs/api/v2/export_settings/list.md
    - docs/api/v2/export_settings/create.md
    - docs/api/v2/export_settings/retrieve.md
    - docs/api/v2/export_settings/patch.md
    - docs/api/v2/export_settings/delete.md
    - docs/api/v2/export_settings/data.md
    """

    model = AssetExportSettings
    lookup_field = 'uid'
    serializer_class = AssetExportSettingsSerializer
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    permission_classes = (AssetExportSettingsPermission,)

    def get_queryset(self):
        return self.model.objects.filter(asset_id=self.asset.id)

    def perform_create(self, serializer):
        serializer.save(asset=self.asset)

    @action(
        detail=True,
        methods=['GET'],
        url_path='data',
        url_name='synchronous-data',
        renderer_classes=(SubmissionCSVRenderer, SubmissionXLSXRenderer),
    )
    def data(self, request, *args, **kwargs):
        AVAILABLE_FORMATS = ('csv', 'xlsx')
        # Serve content directly to these agents instead of redirecting
        BAD_USER_AGENTS = [
            # LibreOffice Calc only refreshes the URL to which it was
            # redirected (at least until you quit and restart it)
            r'^LibreOffice',
            # Microsoft Excel and Power BI fail to send any `Authorization`
            # headers after a 302 redirect, making authentication fail
            r'^Microsoft.Data.Mashup',
        ]

        format_type = kwargs.get('format', request.GET.get('format'))
        if format_type not in AVAILABLE_FORMATS:
            raise serializers.ValidationError(
                t(
                    'Only the following formats are available: ##format list##'
                ).replace('##format list##', ', '.join(AVAILABLE_FORMATS))
            )
        user = get_database_user(self.request.user)
        settings_obj = self.get_object()

        # formpack is expected to behave properly even if the export settings
        # were originally created for a different format
        settings_obj.export_settings['type'] = format_type

        export = SubmissionSynchronousExport.generate_or_return_existing(
           user=user,
           asset_export_settings=settings_obj,
        )
        if export.status != export.COMPLETE:
            # The problem has already been logged by `ImportExportTask.run()`,
            # but pass some information of dubious usefulness back to the
            # client.
            return HttpResponse(
                'Synchronous export failed: ' + str(export.messages),
                content_type='text/plain',
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        bad_user_agent = False
        user_agent = request.META.get('HTTP_USER_AGENT')
        if user_agent:
            for ua_pattern in BAD_USER_AGENTS:
                if re.match(ua_pattern, user_agent):
                    bad_user_agent = True
                    break
        if bad_user_agent:
            return FileResponse(export.result.file)

        file_location = serializers.FileField().to_representation(export.result)
        return HttpResponseRedirect(file_location)
