# coding: utf-8
from rest_framework import (
    renderers,
    serializers,
    viewsets,
)
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models import AssetExportSettings
from kpi.permissions import AssetExportSettingsPermission
from kpi.serializers.v2.asset_export_settings import (
    AssetExportSettingsSerializer,
)
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
    >               "fields": ["field_1", "field_2"]
    >           }
    >        }

    where:

    * "name" (required) is the name of the export setting displayed in the UI
    * "export_settings" (required) is a map of defined settings containing the following valid options:
        * "fields" (optional) is an array of column names to be included in the export (including their group hierarchy). Valid inputs include:
            * An array containing any string value that matches the XML column name
            * An empty array which will result in all columns being included
            * If "fields" is not included in the "export_settings", all columns will be included in the export
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

    **Note that the following behaviour can be expected when specifying a value for the "multiple_select" field:**

    * "summary": Includes one column per question, with all selected choices separated by spaces;
    * "details": Expands each multiple-select question to one column per choice, with each of those columns having a binary 1 or 0 to indicate whether that choice was chosen;
    * "both": Includes the format of "summary" _and_ "details" in the export

    ### Retrieves a specific export setting

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/espj4oFeS9tVhQQMVfitTB2/

    ### Updates an asset's export setting

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

    ### Deletes current export setting

    > Required permissions: `manage_asset` (Manage project)

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/export-settings/<code>{setting_uid}</code>/
    </pre>


    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/espj4oFeS9tVhQQMVfitTB2/


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

