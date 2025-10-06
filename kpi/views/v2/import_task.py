# coding: utf-8
import base64

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import exceptions, status, viewsets
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.models import ImportTask
from kpi.models.import_export_task import ImportExportStatusChoices
from kpi.schema_extensions.v2.imports.serializers import (
    ImportCreateRequestSerializer,
    ImportCreateResponse,
    ImportResponse,
)
from kpi.serializers.v2.import_task import (
    ImportTaskListSerializer,
    ImportTaskSerializer,
)
from kpi.tasks import import_in_background
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
)
from kpi.utils.strings import to_str


@extend_schema(
    tags=['Manage projects and library content'],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'imports/create.md'),
        request={'multipart/form-data': ImportCreateRequestSerializer},
        responses=open_api_201_created_response(
            ImportCreateResponse,
            raise_access_forbidden=False,
        ),
    ),
    list=extend_schema(
        description=read_md('kpi', 'imports/list.md'),
        responses=open_api_200_ok_response(
            ImportResponse(many=True),
            raise_access_forbidden=False,
            validate_payload=False,
            raise_not_found=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'imports/retrieve.md'),
        responses=open_api_200_ok_response(
            ImportResponse(many=False),
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class ImportTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Viewset for imported files

    Available actions:
    - list           → GET       /api/v2/imports/
    - retrieve       → GET       /api/v2/imports/
    - create         → CREATE    /api/v2/imports/{uid}/

    Documentation:
    - docs/api/v2/imports/list.md
    - docs/api/v2/imports/retrieve.md
    - docs/api/v2/imports/create.md
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
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
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
        return Response(
            {
                'uid': import_task.uid,
                'url': reverse(
                    'api_v2:importtask-detail',
                    kwargs={'uid': import_task.uid},
                    request=request,
                ),
                'status': ImportExportStatusChoices.PROCESSING,
            },
            status.HTTP_201_CREATED,
        )
