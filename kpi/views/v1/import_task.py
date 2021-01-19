# coding: utf-8
import base64
import re
import requests
from typing import Tuple, Union

from rest_framework import exceptions, status, viewsets
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.reverse import reverse

from kpi.models import ImportTask
from kpi.serializers import ImportTaskListSerializer, ImportTaskSerializer
from kpi.tasks import import_in_background
from kpi.utils.strings import to_str


class ImportTaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportTask.objects.all()
    serializer_class = ImportTaskSerializer
    lookup_field = 'uid'

    def get_serializer_class(self):
        if self.action == 'list':
            return ImportTaskListSerializer
        else:
            return ImportTaskSerializer

    def get_queryset(self, *args, **kwargs):
        if self.request.user.is_anonymous:
            return ImportTask.objects.none()
        else:
            return ImportTask.objects.filter(
                        user=self.request.user).order_by('date_created')

    def create(self, request, *args, **kwargs):
        if self.request.user.is_anonymous:
            raise exceptions.NotAuthenticated()

        filename, default_project_name = self._get_filenames(request)
        itask_data = {
            'library': request.POST.get('library') not in ['false', False],
            'filename': filename,
            'destination': request.POST.get('destination', None),
        }
        if 'base64Encoded' in request.POST:
            encoded_str = request.POST['base64Encoded']
            encoded_substr = encoded_str[encoded_str.index('base64') + 7:]
            itask_data['base64Encoded'] = encoded_substr
        elif 'file' in request.data:
            encoded_xls = to_str(base64.b64encode(request.data['file'].read()))
            itask_data['base64Encoded'] = encoded_xls
        elif 'url' in request.POST:
            itask_data['single_xls_url'] = request.POST['url']
        import_task = ImportTask.objects.create(user=request.user,
                                                data=itask_data)
        # Have Celery run the import in the background
        import_in_background.delay(import_task_uid=import_task.uid)
        return Response({
            'uid': import_task.uid,
            'url': reverse(
                'importtask-detail',
                kwargs={'uid': import_task.uid},
                request=request),
            'status': ImportTask.PROCESSING,
            'default_project_name': default_project_name
        }, status.HTTP_201_CREATED)

    @staticmethod
    def _get_filenames(
        request: Request,
    ) -> Union[Tuple[str, str], Tuple[None, None]]:
        """
        Return a tuple of the submitted file or url-linked file's name with
        and without its extension

        Args:
            request (Request): DRF request object

        Returns:
            Tuple[str, str] or Tuple[None, None]: A tuple containing first the
            filename with its extension and secondly the filename without its
            extension. If there is no filename, a tuple of None values is
            returned
        """

        XLS_FILE_PATTERN = '((.*?)\.xlsx?)'
        XLS_URL_PATTERN = '\w+="?((.*?)\.xlsx?)"?'

        filename_or_none = request.POST.get('name', None)
        re_pattern = XLS_FILE_PATTERN
        if 'url' in request.POST:
            # The filename from a url-linked submission is contained in the
            # 'Content-Disposition' header when a `GET` request is made
            re_pattern = XLS_URL_PATTERN
            response = requests.get(request.POST['url'])
            filename_from_header = response.headers.get(
                'Content-Disposition', None
            )
            if filename_from_header is not None:
                filename_or_none = filename_from_header
        elif 'file' in request.data and filename_or_none is None:
            filename_or_none = getattr(request.data['file'], 'name', None)

        if filename_or_none is None:
            return (None, None)
        else:
            filenames_re = re.search(re_pattern, filename_or_none)
            return (
                (filename_or_none, filename_or_none)
                if filenames_re is None
                else filenames_re.groups()
            )

