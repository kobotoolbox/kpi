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
    Returns a 410 with a link to the migration article natively via
    DRF content negotiation (JSON, XML, HTML).
    """

    authentication_classes = []
    permission_classes = []
    renderer_classes = [BasicHTMLRenderer, JSONRenderer, XMLRenderer]

    # Used instead of dispatch() because dispatch() runs before DRF's content
    # negotiation (initial()), which would leave accepted_renderer unset on
    # the Response and raise an AssertionError on render.
    def http_method_not_allowed(self, request, *args, **kwargs):
        return self._get_410_response()

    # DRF defines options() by default, so it must be overridden explicitly.
    def options(self, request, *args, **kwargs):
        return self._get_410_response()

    @staticmethod
    def _get_410_response():
        message = _(
            'The V1 API has been removed. Please read the migration '
            'article at https://support.kobotoolbox.org/migrating_api.html'
        )
        return Response({'detail': message}, status=status.HTTP_410_GONE)


v1_api_gone_view = V1APIGoneView.as_view()
