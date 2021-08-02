# coding: utf-8
import base64

from rest_framework import exceptions, status, viewsets
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.reverse import reverse

from kpi.models import ImportTask
from kpi.serializers.v2.import_task import ImportTaskListSerializer, ImportTaskSerializer
from kpi.tasks import import_in_background
from kpi.utils.strings import to_str


class ImportTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ## List of imported files

    Lists all files imported by the requesting user. 
    An empty json response will be returned if the user anonymous.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/imports/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/imports/
    >       {
    >           "count": integer,
    >           "next": ...,
    >           "previous": ...,
    >           "results": [
    >               {
    >                   "url": "https:[kpi]/api/v2/imports/{import_uid}/",
    >                   "status": asset_uid,
    >                   "messages": {
    >                       "updated": [
    >                           {
    >                               "uid": "",
    >                               "kind": "",
    >                               "summary": {
    >                                       "geo": boolean,
    >                                       "labels": [],
    >                                       "columns": [],
    >                                       "languages": [],
    >                                       "row_count": integer,
    >                                       "default_translation": "",
    >                                   },
    >                                   "owner__username": "",
    >                            }
    >                       ]
    >                   },
    >                   "uid": import_uid,
    >                   "date_created": "",
    >               },
    >           ]
    >       }

    """
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
        itask_data = {
            'library': request.POST.get('library') not in ['false', False],
            # NOTE: 'filename' here comes from 'name' (!) in the POST data
            'filename': request.POST.get('name', None),
            'destination': request.POST.get('destination', None),
            'desired_type': request.POST.get('desired_type', None),
        }
        if 'base64Encoded' in request.POST:
            encoded_str = request.POST['base64Encoded']
            encoded_substr = encoded_str[encoded_str.index('base64') + 7:]
            itask_data['base64Encoded'] = encoded_substr
        elif 'file' in request.data:
            encoded_xls = to_str(base64.b64encode(request.data['file'].read()))
            itask_data['base64Encoded'] = encoded_xls
            if 'filename' not in itask_data:
                itask_data['filename'] = request.data['file'].name
        elif 'url' in request.POST:
            itask_data['single_xls_url'] = request.POST['url']
        import_task = ImportTask.objects.create(user=request.user,
                                                data=itask_data)
        # Have Celery run the import in the background
        import_in_background.delay(import_task_uid=import_task.uid)
        return Response({
            'uid': import_task.uid,
            'url': reverse(
                'api_v2:importtask-detail',
                kwargs={'uid': import_task.uid},
                request=request),
            'status': ImportTask.PROCESSING,
        }, status.HTTP_201_CREATED)

