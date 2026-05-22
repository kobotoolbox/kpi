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
    renderer_classes = [BasicHTMLRenderer, JSONRenderer, XMLRenderer]

    def _get_404_response(self):
        message = _(
            'The V1 API has been removed. Please read the migration '
            'article at https://support.kobotoolbox.org/migrating_api.html'
        )
        return Response({'detail': message}, status=status.HTTP_410_GONE)

    def http_method_not_allowed(self, request, *args, **kwargs):
        return self._get_404_response()

    def options(self, request, *args, **kwargs):
        return self._get_404_response()


v1_api_gone_view = V1APIGoneView.as_view()
