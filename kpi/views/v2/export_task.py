# coding: utf-8
from rest_framework import (
    exceptions,
    renderers,
    serializers,
    status,
    viewsets,
)
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.filters import (
    ExportObjectOrderingFilter,
    ExportObjectPermissionsFilter,
    SearchFilter,
)
from kpi.models import ExportTask
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.tasks import export_in_background
from kpi.views.no_update_model import NoUpdateModelViewSet


class ExportTaskViewSet(NoUpdateModelViewSet):
    """
    ## List of export tasks endpoints

    Lists the export tasks accessible to requesting user, for anonymous access
    nothing is returned.

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /api/v2/exports/
    </pre>

    > Examples
    >
    >       curl -X GET https://[kpi]/api/v2/exports/

    > List can be filtered with the [query parser](https://github.com/kobotoolbox/kpi#searching)
    > Query searches within `data.source` and `uid` by default if no field is provided in `q`.

    >       curl -X GET https://[kpi]/api/v2/exports/?q=zVEkrWg5Gd

    Otherwise, the search can be more specific:

    - Exports from a source
    - Exports matching `uid`s

    > Examples:
    >
    > **Exports from source asset uid is `aSAvYreNzVEkrWg5Gdcvg`**
    >
    >      curl -X GET https://[kpi]/api/v2/exports/?q=data__source:https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg
    >
    > **Exports from source asset uid which contains `aSAvYreNzVEkrWg5Gdcvg`**
    >
    >      curl -X GET https://[kpi]/api/v2/exports/?q=data__source__icontains:aSAvYreNzVEkrWg5Gdcvg
    >
    > **Exports matching `uid`s**
    >
    >      curl -X GET https://[kpi]/api/v2/exports/?q=uid__in:ehZUwRctkhp9QfJgvEWGg OR uid__in:ehZUwRctkhp9QfJgvDnjud


    ## CRUD

    > `uid` - is the unique identifier of a specific export task


    ### Creates an export task

    <pre class="prettyprint">
    <b>POST</b> /api/v2/exports/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/exports/

    > **Payload**
    >
    >        {
    >           "data": {
    >               "source": "https://[kpi]/api/v2/assets/aeztFxgduFxPTefFfYhfN7/",
    >               "fields_from_all_versions": "true",
    >               "group_sep": "/",
    >               "hierarchy_in_labels": "true",
    >               "lang": "English (en)",
    >               "multiple_select": "both",
    >               "type": "geojson",
    >               "fields": ["field_1", "field_2"],
    >               "flatten": "true"
    >           }
    >        }

    where:

    * "source" (required) is the URL of the source asset that contains the intended submissions for export
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
    <b>GET</b> /api/v2/exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/exports/ehZUwRctkop9QfJgvDmkdh/


    ### Deletes current export task

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/exports/ehZUwRctkop9QfJgvDmkdh/


    ### CURRENT ENDPOINT
    """

    model = ExportTask
    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'
    renderer_classes = [
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    ]
    # TODO: add permissions class (subclass nested)
    filter_backends = [
        ExportObjectPermissionsFilter,
        SearchFilter,
        ExportObjectOrderingFilter,
    ]
    # Terms that can be used to search and filter return values from a query `q`
    search_default_field_lookups = [
        'data__source__icontains',
        'uid__icontains',
    ]

#    def create(self, request, *args, **kwargs):
#        if self.request.user.is_anonymous:
#            raise exceptions.NotAuthenticated()
#
#        serializer = self.get_serializer(data=request.data)
#        serializer.is_valid(raise_exception=True)
#
#        # Create a new export task
#        print('***** serializer.data', str(serializer.data), flush=True)
#        export_task = ExportTask.objects.create(user=request.user,
#                                                data=serializer.data)
#        # Have Celery run the export in the background
#        export_in_background.delay(export_task_uid=export_task.uid)
#
#        return Response({
#            'uid': export_task.uid,
#            'url': reverse(
#                'api_v2:exporttask-detail',
#                kwargs={'uid': export_task.uid},
#                request=request),
#            'status': ExportTask.PROCESSING
#        }, status.HTTP_201_CREATED)

