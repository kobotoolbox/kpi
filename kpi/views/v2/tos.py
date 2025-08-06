from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer

from hub.models import SitewideMessage
from kpi.schema_extensions.v2.tos.serializers import TermsOfServiceResponse
from kpi.serializers.v2.tos import TermsOfServiceSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(
    tags=['Terms of Services']
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'tos/list.md'),
        responses=open_api_200_ok_response(
            TermsOfServiceResponse,
        )
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'tos/retrieve.md'),
        responses=open_api_200_ok_response(
            TermsOfServiceResponse(many=False),
        )
    )
)
class TermsOfServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    TBC, Terms of service readonly endpoint
    """

    """
    ViewSet for managing the terms of service

    Available actions:
    - list           → GET /api/v2/terms-of-service/
    - retrieve       → GET /api/v2/terms-of-service/{slug}/

    Documentation:
    - docs/api/v2/tos/list.md
    - docs/api/v2/tos/retrieve.md
    """

    queryset = SitewideMessage.objects.filter(slug__startswith='terms_of_service')
    model = SitewideMessage
    lookup_field = 'slug'
    serializer_class = TermsOfServiceSerializer
    pagination_class = None
    permission_classes = (IsAuthenticated,)
    renderer_classes = [
        JSONRenderer,
    ]
