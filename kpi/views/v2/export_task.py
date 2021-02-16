# coding: utf-8
from rest_framework import exceptions, serializers, status, renderers, viewsets
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.filters import (
    ExportObjectPermissionsFilter,
    ExportObjectFilter,
    ExportObjectOrderingFilter,
)
from kpi.models import ExportTask
from kpi.serializers.v2.export_task import ExportTaskSerializer
from kpi.tasks import export_in_background
from kpi.views.no_update_model import NoUpdateModelViewSet
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin

# TODO: make sure to see what NoUpdateModelViewSet is all about
class ExportTaskViewSet(NoUpdateModelViewSet):
    model = ExportTask
    queryset = ExportTask.objects.all()
    serializer_class = ExportTaskSerializer
    lookup_field = 'uid'
    renderer_classes = (
        renderers.BrowsableAPIRenderer,
        renderers.JSONRenderer,
    )
    filter_backends = (
        ExportObjectPermissionsFilter,
        ExportObjectFilter,
        ExportObjectOrderingFilter,
    )

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous:
            raise exceptions.NotAuthenticated()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create a new export task
        export_task = ExportTask.objects.create(user=request.user,
                                                data=serializer.data['data'])
        # Have Celery run the export in the background
        export_in_background.delay(export_task_uid=export_task.uid)
        return Response({
            'uid': export_task.uid,
            'url': reverse(
                'api_v2:exporttask-detail',
                kwargs={'uid': export_task.uid},
                request=request),
            'status': ExportTask.PROCESSING
        }, status.HTTP_201_CREATED)

