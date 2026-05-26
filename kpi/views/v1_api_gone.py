from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_xml.renderers import XMLRenderer

from kpi.renderers import BasicHTMLRenderer


class V1APIGoneView(APIView):
    """
    Catch-all view for the removed V1 API.
    Returns a 404 with a link to the migration article natively via
    DRF content negotiation (JSON, XML, HTML).
    """

    authentication_classes = []
    permission_classes = []
    renderer_classes = [JSONRenderer, XMLRenderer, BasicHTMLRenderer]

    def http_method_not_allowed(self, request, *args, **kwargs):
        message = _(
            'The V1 API has been removed. Please read the migration '
            'article at https://support.kobotoolbox.org/migrating_api.html'
        )
        return Response({'detail': message}, status=status.HTTP_404_NOT_FOUND)


v1_api_gone_view = V1APIGoneView.as_view()
