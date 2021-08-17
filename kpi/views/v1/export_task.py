# coding: utf-8
from django.db.models import TextField
from django.db.models.functions import Cast
from rest_framework import exceptions, serializers, status
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.models import ExportTask
from kpi.models.import_export_task import _resolve_url_to_asset
from kpi.serializers import ExportTaskSerializer
from kpi.tasks import export_in_background
from kpi.utils.models import remove_string_prefix
from kpi.views.no_update_model import NoUpdateModelViewSet


class ExportTaskViewSet(NoUpdateModelViewSet):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/assets/<code>{asset_uid}</code>/exports`**

    ## List of export tasks endpoints

    Lists the export tasks accessible to requesting user, for anonymous access
    nothing is returned.

    > Required permissions: `view_submissions` (View submissions)

    <pre class="prettyprint">
    <b>GET</b> /exports/
    </pre>

    > Examples
    >
    >       curl -X GET https://[kpi]/exports/

    > List can be filtered through the following methods:

    * Source URL or UID if `q=source:[URL|UID]`;
    * Comma-separated list of `ExportTask` UIDs if `q=uid__in:[UID],[UID],...` was provided
    * Data source URL if `q=data__source:[URL]`

    > Examples:
    >
    > **Exports from source asset uid is `aSAvYreNzVEkrWg5Gdcvg`**
    >
    >      curl -X GET https://[kpi]/exports/?q=data__source:https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg
    >
    > Or
    >
    >      curl -X GET https://[kpi]/exports/?q=source:aSAvYreNzVEkrWg5Gdcvg
    >
    > **Exports matching `uid`s**
    >
    >      curl -X GET https://[kpi]/exports/?q=uid__in:ehZUwRctkhp9QfJgvEWGg,ehZUwRctkhp9QfJgvDnjud


    ## CRUD

    > `uid` - is the unique identifier of a specific export task


    ### Creates an export task

    <pre class="prettyprint">
    <b>POST</b> /exports/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/exports/

    > **Payload**
    >
    >        {
    >           "source": "https://[kpi]/api/v2/assets/aeztFxgduFxPTefFfYhfN7/",
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
    <b>GET</b> /exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/exports/ehZUwRctkop9QfJgvDmkdh/


    ### Deletes current export task

    <pre class="prettyprint">
    <b>DELETE</b> /exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/exports/ehZUwRctkop9QfJgvDmkdh/


    ### CURRENT ENDPOINT
    """
    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous:
            return ExportTask.objects.none()

        queryset = ExportTask.objects.filter(
            user=self.request.user).order_by('date_created')

        # Ultra-basic filtering by:
        # * source URL or UID if `q=source:[URL|UID]` was provided;
        # * comma-separated list of `ExportTask` UIDs if
        #   `q=uid__in:[UID],[UID],...` was provided
        q = self.request.query_params.get('q', False)
        if not q:
            # No filter requested
            return queryset
        if q.startswith('source:'):
            q = remove_string_prefix(q, 'source:')
            # Crude, but `data__source` is a URL. Cast `data__source` to a
            # `TextField` to avoid the special behavior of `__contains` for
            # `JSONField`s. See
            # https://docs.djangoproject.com/en/2.2/ref/contrib/postgres/fields/#std:fieldlookup-hstorefield.contains
            queryset = queryset.annotate(
                source_str=Cast('data__source', output_field=TextField())
            ).filter(source_str__contains=q)
        elif q.startswith('uid__in:'):
            q = remove_string_prefix(q, 'uid__in:')
            uids = [uid.strip() for uid in q.split(',')]
            queryset = queryset.filter(uid__in=uids)
        else:
            # Filter requested that we don't understand; make it obvious by
            # returning nothing
            return ExportTask.objects.none()
        return queryset

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous:
            raise exceptions.NotAuthenticated()

        # Read valid options from POST data
        valid_options = (
            'type',
            'source',
            'group_sep',
            'lang',
            'hierarchy_in_labels',
            'fields_from_all_versions',
            'fields',
            'flatten',
        )
        task_data = {}
        for opt in valid_options:
            opt_val = request.POST.get(opt, None)
            if opt_val is not None:
                task_data[opt] = opt_val
        # Complain if no source was specified
        if not task_data.get('source', False):
            raise serializers.ValidationError(
                {'source': 'This field is required.'})
        # Get the source object
        source = _resolve_url_to_asset(
            task_data['source'])
        # Complain if it's not deployed
        if not source.has_deployment:
            raise serializers.ValidationError(
                {'source': 'The specified asset must be deployed.'})
        # Create a new export task
        export_task = ExportTask.objects.create(user=request.user,
                                                data=task_data)
        # Have Celery run the export in the background
        export_in_background.delay(export_task_uid=export_task.uid)
        return Response({
            'uid': export_task.uid,
            'url': reverse(
                'exporttask-detail',
                kwargs={'uid': export_task.uid},
                request=request),
            'status': ExportTask.PROCESSING
        }, status.HTTP_201_CREATED)
