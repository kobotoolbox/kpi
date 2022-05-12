# coding: utf-8
import re

from django.http import FileResponse, HttpResponse, HttpResponseRedirect
from django.utils.translation import gettext as t
from rest_framework import (
    renderers,
    serializers,
    viewsets,
)
from rest_framework import status
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetExportSettings, SynchronousExport
from kpi.permissions import AssetExportSettingsPermission
from kpi.renderers import SubmissionCSVRenderer, SubmissionXLSXRenderer
from kpi.serializers.v2.asset_export_settings import (
    AssetExportSettingsSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AssetExportSettingsViewSet(AssetNestedObjectViewsetMixin,
                          NestedViewSetMixin, viewsets.ModelViewSet):
    """
    ## List of export settings for a specific asset

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/

    ## CRUD

    * `asset_uid` - is the unique identifier of a specific asset
    * `setting_uid` - is the unique identifier of a specific export setting

    ### Create an export setting for an asset

    > Required permissions: `manage_asset` (Manage project)

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/

    > **Payload**
    >
    >        {
    >           "name": "foo",
    >           "export_settings": {
    >               "fields_from_all_versions": "true",
    >               "group_sep": "/",
    >               "hierarchy_in_labels": "true",
    >               "lang": "English (en)",
    >               "multiple_select": "both",
    >               "type": "csv",
    >               "fields": ["field_1", "field_2"],
    >               "flatten": "true",
    >               "xls_types_as_text": "false",
    >               "include_media_url": "false",
    >               "submission_ids": [1, 2, 3, 4],
    >               "query": {
    >                   "$and": [
    >                       {"_submission_time": {"$gte": "2021-08-31"}},
    >                       {"_submission_time": {"$lte": "2021-10-13"}}
    >                   ]
    >               }
    >           }
    >        }

    where:

    * "name" (required) is the name of the export setting displayed in the UI
    * "export_settings" (required) is a map of defined settings containing the following valid options:
        * "fields" (optional) is an array of column names to be included in the export (including their group hierarchy). Valid inputs include:
            * An array containing any string value that matches the XML column name
            * An empty array which will result in all columns being included
            * If "fields" is not included in the "export_settings", all columns will be included in the export
        * "flatten" (optional) is a boolean value and only relevant when exporting to "geojson" format.
        * "fields_from_all_versions" (required) is a boolean to specify whether fields from all form versions will be included in the export.
        * "group_sep" (required) is a value used to separate the names in a hierarchy of groups. Valid inputs include:
            * Non-empty value
        * "hierarchy_in_labels" (required) is a boolean to specify whether the group hierarchy will be displayed in labels
        * "multiple_select" (required) is a value to specify the display of multiple-select-type responses. Valid inputs include:
            * "both",
            * "summary", or
            * "details"
        * "type" (required) specifies the export format. Valid export formats include:
            * "csv",
            * "geojson",
            * "spss_labels", or
            * "xls"
        * "xls_types_as_text" (optional) is a boolean value that defaults to "false" and only affects "xls" export types.
        * "include_media_url" (optional) is a boolean value that defaults to "false" and only affects "xls" and "csv" export types.
        * "submission_ids" (optional) is an array of submission ids that will filter exported submissions to only the specified array of ids. Valid inputs include:
            * An array containing integer values
            * An empty array (no filtering)
        * "query" (optional) is a JSON object containing a Mongo filter query for filtering exported submissions. Valid inputs include:
            * A JSON object containing a valid Mongo query
            * An empty JSON object (no filtering)

    **Note that the following behaviour can be expected when specifying a value for the "multiple_select" field:**

    * "summary": Includes one column per question, with all selected choices separated by spaces;
    * "details": Expands each multiple-select question to one column per choice, with each of those columns having a binary 1 or 0 to indicate whether that choice was chosen;
    * "both": Includes the format of "summary" _and_ "details" in the export

    ### Retrieve a specific export setting

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/espj4oFeS9tVhQQMVfitTB2/

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

    ### Delete current export setting

    > Required permissions: `manage_asset` (Manage project)

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/espj4oFeS9tVhQQMVfitTB2/


    ### Synchronous data export

    To retrieve data synchronously in CSV and XLSX format according to a
    particular instance of export settings, access the URLs given by
    `data_url_csv` and `data_url_xlsx`:
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/data.csv
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/data.xlsx
    </pre>
    <span class='label label-warning'>WARNING</span>
    Processing time of synchronous exports is substantially limited compared to
    asynchronous exports, which are available at
    `/api/v2/assets/{asset_uid}/exports/`.


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

        export = SynchronousExport.generate_or_return_existing(
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
