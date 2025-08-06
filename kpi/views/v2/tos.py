from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer

from hub.models import SitewideMessage
from kpi.serializers.v2.tos import TermsOfServiceSerializer


@extend_schema(
    tags=['Terms of Services']
)
@extend_schema_view(
    list=extend_schema(
        description='list',
    ),
    retrieve=extend_schema(
        description='retrieve',
    )
)
class TermsOfServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    TBC, Terms of service readonly endpoint
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
