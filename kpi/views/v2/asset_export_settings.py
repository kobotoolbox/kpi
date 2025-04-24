# coding: utf-8
import re

from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.utils.translation import gettext as t
from rest_framework import (
    renderers,
    serializers,
    viewsets,
)
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetExportSettings, SubmissionSynchronousExport
from kpi.permissions import AssetExportSettingsPermission
from kpi.renderers import SubmissionCSVRenderer, SubmissionXLSXRenderer
from kpi.serializers.v2.asset_export_settings import (
    AssetExportSettingsSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.views.docs.asset_export_settings.asset_export_setting_docs import (
    export_setting_create,
    export_setting_data,
    export_setting_destroy,
    export_setting_list,
    export_setting_retreive,
    export_setting_update,
    export_setting_partial_update,
)


@extend_schema(
    tags=['export-settings'],
)
@extend_schema_view(
    create=extend_schema(
        description=export_setting_create,
    ),
    data=extend_schema(
        description=export_setting_data,
    ),
    destroy=extend_schema(
        description=export_setting_destroy,
    ),
    list=extend_schema(
        description=export_setting_list,
    ),
    retrieve=extend_schema(
        description=export_setting_retreive,
    ),
    update=extend_schema(
        description=export_setting_update,
    ),
    partial_update=extend_schema(
        description=export_setting_partial_update
    ),
)
class AssetExportSettingsViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):
    """
    ## CRUD

    * `asset_uid` - is the unique identifier of a specific asset
    * `setting_uid` - is the unique identifier of a specific export setting


    ### Update an asset's export setting

    > Required permissions: `manage_asset` (Manage project)

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/espj4oFeS9tVhQQMVfitTB2/

    > **Payload**
    >
    >        {
    >           "name": "bar",
    >           "export_settings": {
    >               "fields_from_all_versions": "true",
    >               "group_sep": "/",
    >               "hierarchy_in_labels": "true",
    >               "lang": "English (en)",
    >               "multiple_select": "both",
    >               "type": "csv",
    >               "fields": ["field_1", "field_2", "field_3"]
    >           }
    >        }

    ### CURRENT ENDPOINT
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
