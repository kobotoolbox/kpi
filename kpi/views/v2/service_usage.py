from docutils.nodes import description
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import renderers, viewsets
from rest_framework.response import Response

from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import ServiceUsageSerializer
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.markdown import read_md


@extend_schema(
    tags=['Service Usage'],
)
@extend_schema_view(
    description=read_md('kpi', 'service_usage/list.md'),
)
class ServiceUsageViewSet(viewsets.GenericViewSet):
    """
    Viewset for managing the service usage of current user

    Available actions:
    - list    → GET /api/v2/service_usage/

    Documentation:
    - docs/api/v2/service_usage/list.md
    """

    renderer_classes = (renderers.JSONRenderer,)
    pagination_class = None
    permission_classes = (IsAuthenticated,)

    def list(self, request, *args, **kwargs):
        serializer = ServiceUsageSerializer(
            get_database_user(request.user),
            context=self.get_serializer_context(),
        )
        return Response(data=serializer.data)
