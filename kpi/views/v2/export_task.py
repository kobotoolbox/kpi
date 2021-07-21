# coding: utf-8
from rest_framework import (
    filters,
    renderers,
)
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.filters import SearchFilter
from kpi.models import ExportTask
from kpi.permissions import ExportTaskPermission
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.views.no_update_model import NoUpdateModelViewSet


class ExportTaskViewSet(
    AssetNestedObjectViewsetMixin, NestedViewSetMixin, NoUpdateModelViewSet
):
    """
    ## List of export tasks endpoints

    Lists the export tasks accessible to requesting user, for anonymous access
    nothing is returned.

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/exports/
    </pre>

    > Examples
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/exports/

    > The list can be filtered with the [query parser](https://github.com/kobotoolbox/kpi#searching)
    > Query searches within `uid` by default if no field is provided in `q`.

    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/exports/?q=zVEkrWg5Gd

    Otherwise, the search can be more specific:

    > Examples:
    > **Exports matching `uid`s**
    >
    >      curl -X GET https://[kpi]/api/v2/assets/<code>{asset_uid}</code>/exports/?q=uid__in:ehZUwRctkhp9QfJgvEWGg OR uid__in:ehZUwRctkhp9QfJgvDnjud


    ## CRUD

    > `uid` - is the unique identifier of a specific export task


    ### Creates an export task

    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{asset_uid}</code>/exports/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/exports/

    > **Payload**
    >
    >        {
    >           "fields_from_all_versions": "true",
    >           "group_sep": "/",
    >           "hierarchy_in_labels": "true",
    >           "lang": "English (en)",
    >           "multiple_select": "both",
    >           "type": "geojson",
    >           "fields": ["field_1", "field_2"],
    >           "flatten": "true"
    >        }

    where:

    * "fields_from_all_versions" (required) is a boolean to specify whether fields from all form versions will be included in the export.
    * "group_sep" (required) is a value used to separate the names in a hierarchy of groups. Valid inputs include:
        * Non-empty value
    * "hierarchy_in_labels" (required) is a boolean to specify whether the group hierarchy will be displayed in labels
    * "multiple_select" (required) is a value to specify the display of `multiple_select`-type responses. Valid inputs include:
        * "both",
        * "summary", or
        * "details"
    * "type" (required) specifies the export format. Valid export formats include:
        * "csv",
        * "geojson",
        * "spss_labels", or
        * "xls"
    * "fields" (optional) is an array of column names to be included in the export (including their group hierarchy). Valid inputs include:
        * An array containing any string value that matches the XML column name
        * An empty array which will result in all columns being included
        * If "fields" is not included in the "export_settings", all columns will be included in the export
    * "flatten" (optional) is a boolean value and only relevant when exporting to "geojson" format.


    ### Retrieves current export task

    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/exports/ehZUwRctkop9QfJgvDmkdh/


    ### Deletes current export task

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{asset_uid}</code>/exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/exports/ehZUwRctkop9QfJgvDmkdh/


    ### CURRENT ENDPOINT
    """

    model = ExportTask
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'
    renderer_classes = [
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    ]
    filter_backends = [
        filters.OrderingFilter,
        SearchFilter,
    ]
    permission_classes = [
        ExportTaskPermission,
    ]
    search_default_field_lookups = [
        'uid__icontains',
    ]

    def get_queryset(self):
        user = get_database_user(self.request.user)
        return self.model.objects.filter(
            user=user,
            data__source__icontains=self.kwargs['parent_lookup_asset'],
        )

