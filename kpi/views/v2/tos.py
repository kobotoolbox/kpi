from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from hub.models import SitewideMessage
from kpi.serializers.v2.tos import TermsOfServiceSerializer


class TermsOfServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    """

    queryset = SitewideMessage.objects.filter(slug__startswith='terms_of_service')
    model = SitewideMessage
    lookup_field = 'slug'
    serializer_class = TermsOfServiceSerializer
    pagination_class = None
    permission_classes = (IsAuthenticated,)
