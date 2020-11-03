# coding: utf-8
from rest_framework import status, exceptions
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.filters import SearchFilter
from kpi.models import ExportTask
from kpi.models.import_export_task import _resolve_url_to_asset_or_collection
from kpi.serializers import ExportTaskSerializer
from kpi.tasks import export_in_background
from kpi.views.no_update_model import NoUpdateModelViewSet


class ExportTaskViewSet(NoUpdateModelViewSet):
    """
    <span class='label label-danger'>TODO</span> Complete documentation

    ## List of export tasks endpoints

    Lists the export tasks accessible to requesting user, for anonymous access
    nothing is returned.

    <pre class="prettyprint">
    <b>GET</b> /exports/
    </pre>

    > Examples
    >
    >       curl -X GET https://[kpi]/exports/

    List can be filtered with the [query parser](https://github.com/kobotoolbox/kpi#searching)
    Query searches within `data.source` and `uid` by default if no field is provided in `q`.

    > Example
    >
    >       curl -X GET https://[kpi]/exports/?q=zVEkrWg5Gd

    Otherwise, the search can be more specific:

    - Exports from a source
    - Exports matching `uid`s

    > Example:
    >
    > **Exports from source asset uid is `aSAvYreNzVEkrWg5Gdcvg`**
    >
    >      curl -X GET https://[kpi]/exports/?q=data__source:https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg
    >
    > **Exports from source asset uid which contains `aSAvYreNzVEkrWg5Gdcvg`**
    >
    >      curl -X GET https://[kpi]/exports/?q=data__source__icontains:aSAvYreNzVEkrWg5Gdcvg
    >
    > **Exports matching `uid`s**
    >
    >      curl -X GET https://[kpi]/exports/?q=uid__in:ehZUwRctkhp9QfJgvEWGg OR uid__in:ehZUwRctkhp9QfJgvDnjud

    ## CRUD

    * `uid` - is the unique identifier of a specific export task

    Retrieves current export task
    <pre class="prettyprint">
    <b>GET</b> /exports/<code>{uid}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/exports/ehZUwRctkop9QfJgvDmkdh/

    Create an export task <span class='label label-danger'>Uncomplete</span>
    <pre class="prettyprint">
    <b>POST</b> /exports/
    </pre>

    ### CURRENT ENDPOINT
    """

    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'

    filter_backends = [
        SearchFilter,
    ]
    # Terms that can be used to search and filter return values
    # from a query `q`
    search_default_field_lookups = [
        'data__source__icontains',
        'uid__icontains',
    ]

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous:
            return ExportTask.objects.none()

        return ExportTask.objects.filter(user=self.request.user). \
            order_by('date_created')
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
        )
        task_data = {}
        for opt in valid_options:
            opt_val = request.POST.get(opt, None)
            if opt_val is not None:
                task_data[opt] = opt_val
        # Complain if no source was specified
        if not task_data.get('source', False):
            raise exceptions.ValidationError(
                {'source': 'This field is required.'})
        # Get the source object
        source_type, source = _resolve_url_to_asset_or_collection(
            task_data['source'])
        # Complain if it's not an Asset
        if source_type != 'asset':
            raise exceptions.ValidationError(
                {'source': 'This field must specify an asset.'})
        # Complain if it's not deployed
        if not source.has_deployment:
            raise exceptions.ValidationError(
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
