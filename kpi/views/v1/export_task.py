# coding: utf-8
from rest_framework import exceptions, serializers, status
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.models import ExportTask
from kpi.models.import_export_task import _resolve_url_to_asset
from kpi.serializers import ExportTaskSerializer
from kpi.tasks import export_in_background
from kpi.utils.export_task import filter_export_tasks
from kpi.views.no_update_model import NoUpdateModelViewSet


class ExportTaskViewSet(NoUpdateModelViewSet):
    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous:
            return ExportTask.objects.none()

        queryset = ExportTask.objects.filter(
            user=self.request.user).order_by('date_created')

        return filter_export_tasks(self.request, queryset)

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
